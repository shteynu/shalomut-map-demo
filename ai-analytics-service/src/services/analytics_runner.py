import logging
from typing import Dict, Any, Optional, Sequence

from src.agents.graph import (
    PROVIDER_UNAVAILABLE_MESSAGE_HEBREW,
    analytics_graph,
    build_failure_payload,
)
from src.agents.state import AnalyticsState, build_initial_state
from src.application.ports import AnalyticsSource, ResultSink, StoneMapPipeline
from src.mcp_client.client import mcp_client_manager
from src.services.result_sink import HttpResultSink

logger = logging.getLogger(__name__)


class AnalyticsRunnerService:
    """One analysis round, from the aggregates to the delivered Stone Map.

    Its three collaborators arrive through the constructor: where the round
    comes from, what analyses it, and where the result goes. The service knows
    none of their transports — no MCP, no HTTP, no graph internals — which is
    what lets a test replace any one of them with an object that has the right
    method.
    """

    def __init__(
        self,
        *,
        source: AnalyticsSource,
        pipeline: StoneMapPipeline,
        sink: ResultSink,
    ):
        self.source = source
        self.pipeline = pipeline
        self.sink = sink

    async def process_round(
        self,
        round_id: str,
        *,
        run_id: Optional[str] = None,
        lease_token: Optional[str] = None,
        regenerate_dimension_ids: Optional[Sequence[str]] = None,
        previous_result: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Executes the end-to-end AI analytics workflow:
        1. Fetch round data from the analytics source
        2. Run the async graph-style analytics workflow
        3. Deliver the compiled Stone Map payload to the result sink

        `regenerate_dimension_ids` and `previous_result` arrive together from
        the claimed job and turn this into a partial run: the named dimensions
        are written again and the rest start from the copy the previous map
        already carries. The delivered payload is a whole map either way —
        every stone, every number recomputed from this round's aggregates —
        which is what keeps the callback contract and Core's own verification
        exactly as they were.
        """
        if bool(run_id) != bool(lease_token):
            raise ValueError(
                "Durable analysis requires both run_id and lease_token"
            )

        logger.info(f"[AnalyticsRunner] Starting processing for round: {round_id}")

        # Step 1: Fetch the round's aggregates
        round_analytics = await self.source.fetch_round_analytics(round_id)
        if round_analytics.roundId != round_id:
            raise RuntimeError(
                "MCP round isolation mismatch: requested round does not "
                "match the returned analytics round"
            )

        # Step 2: Initialize workflow state
        org_context = round_analytics.organizationContext or {}
        if round_analytics.organizationId:
            org_context = {
                **org_context,
                "organizationId": round_analytics.organizationId,
            }
        initial_state: AnalyticsState = build_initial_state(
            round_data=(
                round_analytics.model_dump()
                if hasattr(round_analytics, "model_dump")
                else round_analytics.to_dict()
            ),
            org_context=org_context,
            regenerate_dimension_ids=regenerate_dimension_ids,
            previous_result=previous_result,
        )
        if initial_state.get("regenerate_dimension_ids"):
            logger.info(
                "[AnalyticsRunner] Partial run for round %s writes %s again; "
                "the other dimensions keep the copy they already have",
                round_id,
                ",".join(initial_state["regenerate_dimension_ids"]),
            )

        callback_identity = (
            {"run_id": run_id, "lease_token": lease_token}
            if run_id and lease_token
            else {}
        )

        # Step 3: Execute the workflow
        try:
            final_state = await self.pipeline.ainvoke(initial_state)
            final_payload = final_state.get("final_payload", {})
        except Exception:
            # The durable job is already running (or the legacy webhook has
            # answered 202), so a crash here must still be reported in the
            # callback shape Core accepts.
            logger.exception(
                "[AnalyticsRunner] Analytics workflow failed for round %s; "
                "reporting the failure to the Data Layer",
                round_id,
            )
            await self.sink.deliver(
                round_id,
                build_failure_payload(
                    initial_state["round_data"],
                    failure_reason="service_error",
                    error_message=PROVIDER_UNAVAILABLE_MESSAGE_HEBREW,
                ),
                **callback_identity,
            )
            raise

        # Step 4: Callback / Output delivery
        await self.sink.deliver(round_id, final_payload, **callback_identity)

        return final_payload


# The default composition: the real MCP client, the real graph, the real
# callback. A caller that wants different collaborators builds its own.
analytics_runner_service = AnalyticsRunnerService(
    source=mcp_client_manager,
    pipeline=analytics_graph,
    sink=HttpResultSink(),
)
