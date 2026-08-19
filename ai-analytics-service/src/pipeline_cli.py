import asyncio
import json
import logging
import os
import sys
from typing import Any, Dict

from src.agents.graph import analytics_graph
from src.agents.state import AnalyticsState, build_initial_state
from src.schemas.mcp_types import RoundAnalyticsResult

# The service logs what a round did at INFO — every `adaptation=`, every
# `outcome=usage`, every refusal and the shape behind it. `src/main.py`
# configures logging for the HTTP app; nothing configured it here, so the root
# logger stayed at WARNING and a local pipeline run threw all of it away. That
# is the half of a paid round that says what it cost and which gate turned
# something away, and it was invisible in the one entry point built for
# measuring. stderr, because stdout carries the result JSON.
logging.basicConfig(
    level=os.getenv("PIPELINE_LOG_LEVEL", "INFO").upper(),
    stream=sys.stderr,
    format="%(levelname)s %(message)s",
)


async def run_pipeline(round_data: Dict[str, Any]) -> Dict[str, Any]:
    analytics = RoundAnalyticsResult.from_dict(round_data)
    initial_state: AnalyticsState = build_initial_state(
        round_data=analytics.model_dump(),
        org_context=analytics.organizationContext or {},
    )
    final_state = await analytics_graph.ainvoke(initial_state)
    return final_state.get("final_payload", {})


def main() -> None:
    round_data = json.load(sys.stdin)
    result = asyncio.run(run_pipeline(round_data))
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
