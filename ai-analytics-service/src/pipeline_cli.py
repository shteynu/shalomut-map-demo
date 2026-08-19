import asyncio
import json
import logging
import sys
from typing import Any, Dict

from src.agents.graph import analytics_graph
from src.agents.state import AnalyticsState, build_initial_state
from src.schemas.mcp_types import RoundAnalyticsResult


async def run_pipeline(round_data: Dict[str, Any]) -> Dict[str, Any]:
    analytics = RoundAnalyticsResult.from_dict(round_data)
    initial_state: AnalyticsState = build_initial_state(
        round_data=analytics.model_dump(),
        org_context=analytics.organizationContext or {},
    )
    final_state = await analytics_graph.ainvoke(initial_state)
    return final_state.get("final_payload", {})


def main() -> None:
    # The service logs what each answer cost, which model wrote it and why a
    # dimension fell back — at INFO, onto the root logger nobody configures
    # here. `main.py` configures it for the server; this entrypoint did not, so
    # every one of those lines was dropped and a local run could report which
    # stones came back but never what they cost. Onto stderr, deliberately:
    # stdout is the payload its caller parses.
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)

    round_data = json.load(sys.stdin)
    result = asyncio.run(run_pipeline(round_data))
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
