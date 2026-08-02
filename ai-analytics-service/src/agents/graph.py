import logging
from datetime import datetime, timezone
from typing import Dict, Any, Literal
from src.agents.state import AnalyticsState
from src.schemas.contract_registry import get_capabilities
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
from src.agents.safety_report import violation
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
)
from src.schemas.stone_map_validation import outgoing_refusal

logger = logging.getLogger(__name__)

# Copy the manager reads when no analysis could be produced. One sentence for
# what happened and one for what to do; the machine-readable `failureReason`
# carries the distinction, so the person is not asked to read a transport code.
PROVIDER_UNAVAILABLE_MESSAGE_HEBREW = (
    "שירות הניתוח אינו זמין כרגע ולכן לא הופק ניתוח לסבב הזה. "
    "אפשר להפעיל את הניתוח שוב בעוד מספר דקות."
)
VALIDATION_FAILED_MESSAGE_HEBREW = (
    "לא ניתן להפיק ניתוח מאומת מן הנתונים המצרפיים."
)


def build_failure_payload(
    round_data: Dict[str, Any],
    *,
    failure_reason: str,
    error_message: str,
) -> Dict[str, Any]:
    """The one shape a failed round travels in.

    `status` stays inside the versioned set Core validates. `failureReason` is
    additive and optional: the existing callback validator accepts it on a
    non-success payload, so a stored failure can say whether the provider was
    unreachable or its output never passed validation without a contract bump.
    """
    dynamic_metadata = (
        {"surveyDefinitionHash": round_data.get("surveyDefinitionHash")}
        if get_capabilities(_effective_contract_version(round_data)).supportsDynamicQuestions
        else {}
    )
    return {
        "contractVersion": _effective_contract_version(round_data),
        "roundId": round_data.get("roundId", ""),
        **dynamic_metadata,
        "processedAt": datetime.now(timezone.utc).isoformat(),
        "isLocked": False,
        "status": "validation_failed",
        "failureReason": failure_reason,
        "errorMessage": error_message,
    }


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

            # A provider that answered nothing is not a quality problem, so the
            # safety loop has nothing to improve on a second pass: the transport
            # already spent its own bounded retries. The round ends here and the
            # manager is told the service is down.
            if current_state.get("safety_status") == "provider_unavailable":
                return {
                    **current_state,
                    "final_payload": build_failure_payload(
                        current_state.get("round_data", {}),
                        failure_reason="provider_unavailable",
                        error_message=PROVIDER_UNAVAILABLE_MESSAGE_HEBREW,
                    ),
                }

            current_state = agent_rag_intervention_node(current_state)
            current_state = await agent_adaptation_node(current_state)
            current_state = agent_safety_validator_node(current_state)

            if current_state.get("safety_status") == "fail" and current_state.get("retry_count", 0) < 3:
                continue

            if current_state.get("safety_status") != "pass":
                return {
                    **current_state,
                    "final_payload": build_failure_payload(
                        current_state.get("round_data", {}),
                        failure_reason="validation_failed",
                        error_message=VALIDATION_FAILED_MESSAGE_HEBREW,
                    ),
                }

            # Step 3: Format Output, and ask whether Core would take it.
            #
            # The safety validator judges the state — the copy each node wrote.
            # Nothing judged the assembled payload, so a round could pass every
            # check here and still be refused at the callback, where the model
            # calls are already paid for and no retry is left. This asks the
            # same question one step earlier, while the loop can still act.
            formatted = format_stone_map_output_node(current_state)
            refusal = outgoing_refusal(formatted.get("final_payload"))
            if refusal is None:
                return formatted

            if refusal.repairable and current_state.get("retry_count", 0) < 3:
                logger.warning(
                    "[Output] The assembled payload would be refused: %s. "
                    "Replaying target=%s dimension=%s",
                    refusal.rule,
                    refusal.target,
                    refusal.dimension_id or "-",
                )
                current_state = _replay_for_outgoing_refusal(
                    current_state,
                    refusal,
                )
                continue

            logger.error(
                "[Output] The assembled payload would be refused and cannot "
                "be repaired by a replay: %s",
                refusal.rule,
            )
            return {
                **current_state,
                "final_payload": build_failure_payload(
                    current_state.get("round_data", {}),
                    failure_reason=f"outgoing_{refusal.rule}",
                    error_message=VALIDATION_FAILED_MESSAGE_HEBREW,
                ),
            }


def _replay_for_outgoing_refusal(state, refusal) -> AnalyticsState:
    """Turn a payload-level refusal into the replay the loop already knows.

    It writes the same bookkeeping the safety validator writes, including the
    coded violation, so the repair prompt carries a critique rather than asking
    for the identical answer on a costlier model.
    """
    dimensions = [refusal.dimension_id] if refusal.dimension_id else []
    return {
        **state,
        "safety_status": "fail",
        "safety_feedback": f"Outgoing payload would be refused: {refusal.rule}",
        "safety_violations": [
            violation(refusal.rule, refusal.target, refusal.dimension_id),
        ],
        "retry_count": min(3, state.get("retry_count", 0) + 1),
        "retry_interpretation_dimensions": (
            dimensions if refusal.target == "interpretation" else []
        ),
        "retry_recommendation_dimensions": (
            dimensions if refusal.target == "recommendation" else []
        ),
        "retry_overall_summary": refusal.target == "overall_summary",
    }

def format_stone_map_output_node(state: AnalyticsState) -> AnalyticsState:
    """
    Final Formatter Node: Assembles the structured "Stone Map" JSON payload.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    interpretations = state.get("interpretations", {}).get("dimension_interpretations", {})
    dimension_summaries = state.get("interpretations", {}).get(
        "dimension_summaries",
        {},
    )
    metric_insights = state.get("interpretations", {}).get(
        "metric_insights",
        {},
    )
    overall_summary = state.get("interpretations", {}).get("overall_summary", "")
    recommendations = state.get("recommendations", {})
    generation_provenance = state.get("generation_provenance", {})
    contract_version = _effective_contract_version(round_data)

    if (
        get_capabilities(contract_version).supportsDynamicQuestions
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
                and get_capabilities(contract_version).supportsDynamicQuestions
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
                    get_capabilities(contract_version).supportsScoreDistribution
                    and isinstance(aggregate.get("scoreDistribution"), dict)
                ):
                    metric["scoreDistribution"] = dict(
                        aggregate["scoreDistribution"],
                    )
                if get_capabilities(
                    contract_version,
                ).usesNarrativeMetrics:
                    metric["insightText"] = metric_insights.get(
                        dim_id,
                        {},
                    ).get(aggregate["questionId"], "")
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
            "recommendedInterventions": recs,
            "metrics": metrics
        }
        if get_capabilities(contract_version).usesStructuredDimensionSummary:
            stone["summary"] = dimension_summaries.get(dim_id, [])
        else:
            stone["psychologicalInterpretation"] = interp
        if get_capabilities(contract_version).isSemanticContract:
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
    if get_capabilities(contract_version).supportsDynamicQuestions:
        final_payload["surveyDefinitionHash"] = round_data.get(
            "surveyDefinitionHash",
        )
    if get_capabilities(contract_version).supportsPartialMaps:
        # Stated whenever the map is partial, and omitted when it is whole, so
        # a full round's payload is byte-identical to what it was before the
        # partial map existed. Core requires this list to agree exactly with
        # the stones: a banner that disagrees with the map is how a manager
        # stops trusting the screen.
        gaps = sorted(
            dim_id
            for dim_id, provenance in generation_provenance.items()
            if provenance.get("outcome") == "unavailable"
        )
        if gaps:
            final_payload["dimensionsWithoutInterpretation"] = gaps

    return {
        **state,
        "final_payload": final_payload
    }

analytics_graph = AnalyticsGraphEngine()
