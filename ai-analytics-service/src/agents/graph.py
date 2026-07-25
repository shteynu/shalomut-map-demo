from datetime import datetime, timezone
from typing import Dict, Any, Literal
from src.agents.state import AnalyticsState
from src.agents.nodes import (
    privacy_gate_node,
    agent_psychologist_node,
    agent_rag_intervention_node,
    agent_safety_validator_node,
    DIMENSION_NAMES_HEBREW
)
from src.contracts import AI_ANALYTICS_CONTRACT_VERSION

class AnalyticsGraphEngine:
    """
    Async graph-style engine implementing the directed cyclic workflow:
    Privacy_Gate -> Psychologist -> Intervention Catalog -> Safety Validator (Loop / Pass) -> Output Formatter
    """
    async def ainvoke(self, state: AnalyticsState) -> AnalyticsState:
        # Step 1: Privacy Gate
        current_state = privacy_gate_node(state)
        if current_state.get("safety_status") == "privacy_locked":
            return current_state

        # Step 2: Psychologist Node & Loop
        while True:
            current_state = await agent_psychologist_node(current_state)
            current_state = agent_rag_intervention_node(current_state)
            current_state = agent_safety_validator_node(current_state)

            if current_state.get("safety_status") == "fail" and current_state.get("retry_count", 0) < 3:
                continue
            break

        # Step 3: Format Output
        current_state = format_stone_map_output_node(current_state)
        return current_state

def format_stone_map_output_node(state: AnalyticsState) -> AnalyticsState:
    """
    Final Formatter Node: Assembles the structured "Stone Map" JSON payload.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    interpretations = state.get("interpretations", {}).get("dimension_interpretations", {})
    overall_summary = state.get("interpretations", {}).get("overall_summary", "")
    recommendations = state.get("recommendations", {})

    stones = {}
    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = score_obj.get("averageScore", 0.0)
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = getattr(score_obj, "averageScore", 0.0)

        dim_hebrew = DIMENSION_NAMES_HEBREW.get(dim_id, dim_id)
        interp = interpretations.get(dim_id, "")
        recs = recommendations.get(dim_id, [])

        metrics = [
            {"label": "ציון ממוצע", "value": f"{score:.1f}"},
            {"label": "סטטוס מחוון", "value": status.upper()},
            {"label": "רמת סיכון", "value": "גבוהה" if status == "red" else ("בינונית" if status == "yellow" else "תקינה")}
        ]

        stones[dim_id] = {
            "dimensionId": dim_id,
            "dimensionNameHebrew": dim_hebrew,
            "status": status,
            "score": score,
            "psychologicalInterpretation": interp,
            "recommendedInterventions": recs,
            "metrics": metrics
        }

    final_payload = {
        "contractVersion": AI_ANALYTICS_CONTRACT_VERSION,
        "roundId": round_data.get("roundId", ""),
        "processedAt": datetime.now(timezone.utc).isoformat(),
        "isLocked": False,
        "status": "success",
        "overallPsychologicalSummary": overall_summary,
        "stones": stones
    }

    return {
        **state,
        "final_payload": final_payload
    }

analytics_graph = AnalyticsGraphEngine()
