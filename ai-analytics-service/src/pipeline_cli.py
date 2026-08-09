import asyncio
import json
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
    round_data = json.load(sys.stdin)
    result = asyncio.run(run_pipeline(round_data))
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
