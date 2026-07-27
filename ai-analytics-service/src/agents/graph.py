from datetime import datetime, timezone
from typing import Dict, Any, Literal
from src.agents.state import AnalyticsState
from src.agents.nodes import (
    privacy_gate_node,
    agent_psychologist_node,
    agent_rag_intervention_node,
    agent_adaptation_node,
    agent_safety_validator_node,
    DIMENSION_NAMES_HEBREW,
    _effective_contract_version,
    _question_aggregates_for_dimension,
)
from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
    AI_ANALYTICS_V5_CONTRACT_VERSION,
)

class AnalyticsGraphEngine:
    """
    Async graph-style engine implementing the directed cyclic workflow:
    Privacy_Gate -> Psychologist -> Intervention Catalog -> Adaptation -> Safety Validator (Loop / Pass) -> Output Formatter
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
            current_state = await agent_adaptation_node(current_state)
            current_state = agent_safety_validator_node(current_state)

            if current_state.get("safety_status") == "fail" and current_state.get("retry_count", 0) < 3:
                continue
            break

        if current_state.get("safety_status") != "pass":
            round_data = current_state.get("round_data", {})
            dynamic_metadata = (
                {
                    "surveyDefinitionHash": round_data.get(
                        "surveyDefinitionHash",
                    ),
                }
                if _effective_contract_version(round_data)
                in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS
                else {}
            )
            return {
                **current_state,
                "final_payload": {
                    "contractVersion": _effective_contract_version(
                        round_data,
                    ),
                    "roundId": round_data.get("roundId", ""),
                    **dynamic_metadata,
                    "isLocked": False,
                    "status": "validation_failed",
                    "errorMessage": (
                        "לא ניתן להפיק ניתוח מאומת מן הנתונים המצרפיים."
                    ),
                },
            }

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
    generation_provenance = state.get("generation_provenance", {})
    contract_version = _effective_contract_version(round_data)

    if (
        contract_version in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS
        and set(dim_scores) != set(AI_ANALYTICS_DIMENSION_IDS)
    ):
        raise ValueError(
            "AI analytics contract 3.0 requires exactly eight stones"
        )

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
        question_aggregates = _question_aggregates_for_dimension(
            round_data,
            dim_id,
        )

        if question_aggregates:
            question_text_field = (
                "questionText"
                if contract_version
                in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS
                else "questionTextHebrew"
            )
            metrics = []
            for aggregate in question_aggregates:
                metric = {
                    "questionId": aggregate["questionId"],
                    "label": aggregate[question_text_field],
                    "value": (
                        f"{aggregate['averageScore']:.1f} מתוך 100"
                    ),
                    "averageScore": aggregate["averageScore"],
                    "responseCount": aggregate["responseCount"],
                }
                # 5.0 carries the distribution back out exactly as it came in,
                # never recomputed: Core owns these numbers and now has
                # something to check them against.
                if (
                    contract_version == AI_ANALYTICS_V5_CONTRACT_VERSION
                    and isinstance(aggregate.get("scoreDistribution"), dict)
                ):
                    metric["scoreDistribution"] = dict(
                        aggregate["scoreDistribution"],
                    )
                metrics.append(metric)
        else:
            metrics = [
                {"label": "ציון ממוצע", "value": f"{score:.1f}"},
                {"label": "סטטוס מחוון", "value": status.upper()},
                {
                    "label": "רמת סיכון",
                    "value": (
                        "גבוהה"
                        if status == "red"
                        else "בינונית" if status == "yellow" else "תקינה"
                    ),
                },
            ]

        stone = {
            "dimensionId": dim_id,
            "dimensionNameHebrew": dim_hebrew,
            "status": status,
            "score": score,
            "psychologicalInterpretation": interp,
            "recommendedInterventions": recs,
            "metrics": metrics
        }
        if contract_version in {
            AI_ANALYTICS_CONTRACT_VERSION,
            *AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
        }:
            if dim_id not in generation_provenance:
                raise ValueError(
                    f"Missing generation provenance for '{dim_id}'"
                )
            stone["generationProvenance"] = generation_provenance[dim_id]
        stones[dim_id] = stone

    final_payload = {
        "contractVersion": contract_version,
        "roundId": round_data.get("roundId", ""),
        "processedAt": datetime.now(timezone.utc).isoformat(),
        "isLocked": False,
        "status": "success",
        "overallPsychologicalSummary": overall_summary,
        "stones": stones
    }
    if contract_version in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS:
        final_payload["surveyDefinitionHash"] = round_data.get(
            "surveyDefinitionHash",
        )

    return {
        **state,
        "final_payload": final_payload
    }

analytics_graph = AnalyticsGraphEngine()
