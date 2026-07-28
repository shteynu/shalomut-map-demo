import asyncio
import json
import logging
import urllib.request
from urllib.parse import quote, urlsplit
from typing import Dict, Any
from src.mcp_client.client import mcp_client_manager
from src.agents.graph import (
    PROVIDER_UNAVAILABLE_MESSAGE_HEBREW,
    analytics_graph,
    build_failure_payload,
)
from src.agents.state import AnalyticsState
from src.config import settings

logger = logging.getLogger(__name__)

CALLBACK_TIMEOUT_SECONDS = 5.0

def _url_origin(url: str):
    try:
        parsed = urlsplit(url)
        scheme = parsed.scheme.lower()
        if scheme not in {"http", "https"} or not parsed.hostname:
            return None
        port = parsed.port or (443 if scheme == "https" else 80)
        return scheme, parsed.hostname.lower().rstrip("."), port
    except ValueError:
        return None

class AnalyticsRunnerService:
    async def process_round(self, round_id: str) -> Dict[str, Any]:
        """
        Executes the end-to-end AI analytics workflow:
        1. Fetch round data via MCP Client
        2. Run the async graph-style analytics workflow
        3. Deliver compiled Stone Map JSON payload back to Data Layer
        """
        logger.info(f"[AnalyticsRunner] Starting processing for round: {round_id}")

        # Step 1: Fetch data via MCP Client
        round_analytics = await mcp_client_manager.fetch_round_analytics(round_id)
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
        initial_state: AnalyticsState = {
            "round_data": round_analytics.model_dump() if hasattr(round_analytics, "model_dump") else round_analytics.to_dict(),
            "org_context": org_context,
            "interpretations": {},
            "recommendations": {},
            "safety_status": "pending",
            "safety_feedback": None,
            "retry_count": 0,
            "final_payload": {}
        }

        callback_base = settings.data_layer_callback_url.rstrip("/")
        encoded_round_id = quote(round_id, safe="")
        target_callback = f"{callback_base}/{encoded_round_id}/ai-insights/"

        # Step 3: Execute the workflow
        try:
            final_state = await analytics_graph.ainvoke(initial_state)
            final_payload = final_state.get("final_payload", {})
        except Exception:
            # The webhook has already answered 202, so a crash here would
            # otherwise be silent: Core would keep waiting for a callback that
            # never comes and the manager would keep reading "not generated
            # yet". The round data is in hand, so the failure can be reported
            # in the shape Core accepts.
            logger.exception(
                "[AnalyticsRunner] Analytics workflow failed for round %s; "
                "reporting the failure to the Data Layer",
                round_id,
            )
            await self._send_callback(
                target_callback,
                build_failure_payload(
                    initial_state["round_data"],
                    failure_reason="service_error",
                    error_message=PROVIDER_UNAVAILABLE_MESSAGE_HEBREW,
                ),
            )
            raise

        # Step 4: Callback / Output delivery
        await self._send_callback(target_callback, final_payload)

        return final_payload

    async def _send_callback(self, callback_url: str, payload: Dict[str, Any]):
        """
        Sends the compiled payload back to the Data Layer HTTP callback endpoint.
        """
        callback_origin = _url_origin(callback_url)
        data_layer_origin = _url_origin(settings.data_layer_callback_url)
        if (
            callback_origin is None
            or data_layer_origin is None
            or callback_origin != data_layer_origin
        ):
            raise RuntimeError(
                "Refusing callback outside the configured Data Layer origin"
            )

        req_bytes = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if settings.ai_callback_secret:
            headers["Authorization"] = f"Bearer {settings.ai_callback_secret}"
        if settings.vercel_protection_bypass:
            headers["x-vercel-protection-bypass"] = settings.vercel_protection_bypass

        logger.info("[AnalyticsRunner] Posting final Stone Map payload")
        req = urllib.request.Request(
            callback_url,
            data=req_bytes,
            headers=headers,
            method="POST"
        )

        try:
            status = await asyncio.to_thread(self._post_callback, req)
            logger.info(f"[AnalyticsRunner] Callback response status: {status}")
        except Exception as e:
            raise RuntimeError(
                f"Unable to deliver AI analytics callback: {e}"
            ) from e

    @staticmethod
    def _post_callback(req: urllib.request.Request) -> int:
        """
        Blocking delivery, executed in a worker thread so the event loop stays
        responsive while the Data Layer persists the Stone Map.
        """
        with urllib.request.urlopen(req, timeout=CALLBACK_TIMEOUT_SECONDS) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"Callback returned HTTP {response.status}")
            return response.status

analytics_runner_service = AnalyticsRunnerService()
