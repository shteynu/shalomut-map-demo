import asyncio
import json
import sys
from typing import Any, Dict

from src.agents.graph import analytics_graph
from src.agents.state import AnalyticsState
from src.schemas.mcp_types import RoundAnalyticsResult


async def run_pipeline(round_data: Dict[str, Any]) -> Dict[str, Any]:
    analytics = RoundAnalyticsResult.from_dict(round_data)
    initial_state: AnalyticsState = {
        "round_data": analytics.model_dump(),
        "org_context": analytics.organizationContext or {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }
    final_state = await analytics_graph.ainvoke(initial_state)
    return final_state.get("final_payload", {})


def main() -> None:
    round_data = json.load(sys.stdin)
    result = asyncio.run(run_pipeline(round_data))
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
