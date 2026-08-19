import logging
import re
from typing import Any, Dict, Optional
from src.agents.state import AnalyticsState
from src.agents.nodes import (
    privacy_gate_node,
    agent_psychologist_node,
    agent_rag_intervention_node,
    agent_adaptation_node,
    agent_safety_validator_node,
    DIMENSION_NAMES_HEBREW,
    _effective_contract_version,
)
from src.agents.safety_report import violation
from src.contracts import AI_ANALYTICS_DIMENSION_IDS
from src.application.ports import TextGenerator
from src.schemas.analytics_output import encode_failure, encode_stone_map
from src.schemas.contract_registry import get_capabilities
from src.schemas.canonical import (
    CanonicalAnalysisInput,
    CanonicalAnalysisResult,
    CanonicalMetric,
    CanonicalStone,
)
from src.schemas.stone_map_validation import outgoing_refusal
from src.services.llm_provider import llm_provider_service

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


PROVIDER_UNAVAILABLE_FAILURE_REASON = "provider_unavailable"
_MAX_FAILURE_DETAIL_LENGTH = 40


def _provider_failure_code(state: AnalyticsState) -> str:
    """`provider_unavailable`, said as precisely as the run can say it.

    The transport knows whether the key was missing, the provider answered 429,
    the retry budget ran out or the copy never passed validation, and the
    psychologist node puts that in `provider_failure_reason`. Core stores this
    string as the run's `failureCode` and labels its operational metric with
    it, so the difference between "we are misconfigured" and "the provider is
    rate-limiting us" is the difference between two different Tuesdays.

    The prefix stays, so anything grouping by the category still groups. The
    detail is normalised because some reasons are exception class names and one
    is `http_<status>`: a metric label is a bad place for arbitrary text. The
    charset and the length cap are Core's own `isValidFailureCode` — lowercase,
    digits and underscores, at most 64 characters.
    """
    detail = str(state.get("provider_failure_reason") or "").strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "_", detail).strip("_")
    if not slug:
        return PROVIDER_UNAVAILABLE_FAILURE_REASON
    return (
        f"{PROVIDER_UNAVAILABLE_FAILURE_REASON}_"
        f"{slug[:_MAX_FAILURE_DETAIL_LENGTH]}"
    )


def build_failure_payload(
    round_data: Dict[str, Any],
    *,
    failure_reason: str,
    error_message: str,
) -> Dict[str, Any]:
    """The shape a failed round travels in, as this version describes it."""
    return encode_failure(
        CanonicalAnalysisInput.from_round_data(round_data),
        _effective_contract_version(round_data),
        failure_reason=failure_reason,
        error_message=error_message,
    )


class AnalyticsGraphEngine:
    """
    Async graph-style engine implementing the directed cyclic workflow:
    Privacy_Gate -> Psychologist -> Intervention Catalog -> Adaptation -> Safety Validator (Loop / Pass) -> Output Formatter

    The engine owns the one collaborator its nodes cannot do without: whatever
    writes the Hebrew copy. Everything else a node needs is in the state.
    """

    def __init__(self, *, generator: TextGenerator = llm_provider_service):
        self.generator = generator

    async def ainvoke(self, state: AnalyticsState) -> AnalyticsState:
        # Step 1: Privacy Gate
        current_state = privacy_gate_node(state)
        if current_state.get("safety_status") == "privacy_locked":
            return current_state

        # Step 2: Psychologist Node & Loop
        while True:
            current_state = await agent_psychologist_node(
                current_state,
                generator=self.generator,
            )

            # A provider that answered nothing is not a quality problem, so the
            # safety loop has nothing to improve on a second pass: the transport
            # already spent its own bounded retries. The round ends here and the
            # manager is told the service is down.
            if current_state.get("safety_status") == "provider_unavailable":
                return {
                    **current_state,
                    "final_payload": build_failure_payload(
                        current_state.get("round_data", {}),
                        failure_reason=_provider_failure_code(current_state),
                        error_message=PROVIDER_UNAVAILABLE_MESSAGE_HEBREW,
                    ),
                }

            current_state = agent_rag_intervention_node(current_state)
            current_state = await agent_adaptation_node(
                current_state,
                generator=self.generator,
            )
            current_state = agent_safety_validator_node(current_state)

            if current_state.get("safety_status") == "fail" and current_state.get("retry_count", 0) < 3:
                continue

            if current_state.get("safety_status") != "pass":
                # The repair budget is spent. If what is left is a few
                # dimensions whose copy this round could not get right, the
                # round still knows seven other things worth saying, and
                # throwing all of them away to report one refusal is the
                # expensive answer. Drop those dimensions to a stated gap and
                # ask the validator again — the second pass is what decides,
                # so nothing is assumed to be safe merely because it was
                # degraded.
                degraded = _degrade_to_partial_map(current_state)
                if degraded is not None:
                    current_state = agent_safety_validator_node(degraded)

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


def _degrade_to_partial_map(state: AnalyticsState) -> Optional[AnalyticsState]:
    """Turn dimensions this round could not write into a stated gap.

    Returns ``None`` — meaning the round fails whole — unless every refusal
    left is one dimension's copy on a contract that describes partial maps.
    The exclusions are deliberate:

    * A refused overall summary or a refused recommendation is not a gap. The
      contract has no way to say "this round has no summary", so a map missing
      one is a map Core will reject.
    * A refusal with no dimension attached cannot be attributed, and a gap that
      cannot be attributed is a map that disagrees with its own banner.
    * Every dimension failing is not a partial map. Core says so explicitly,
      and it is the right rule: eight gaps is a failed round wearing a map's
      shape.
    """
    round_data = state.get("round_data", {})
    capabilities = get_capabilities(_effective_contract_version(round_data))
    if not capabilities.supportsPartialMaps:
        return None

    violations = state.get("safety_violations", [])
    if not violations:
        return None
    if any(
        item.get("target") != "interpretation" or not item.get("dimensionId")
        for item in violations
    ):
        return None

    gaps = {str(item["dimensionId"]) for item in violations}
    if len(gaps) >= len(AI_ANALYTICS_DIMENSION_IDS):
        return None

    logger.warning(
        "[Safety] Repair budget spent; reporting %s of %s dimension(s) as a "
        "stated gap rather than failing the round: %s",
        len(gaps),
        len(AI_ANALYTICS_DIMENSION_IDS),
        ",".join(sorted(gaps)),
    )

    interpretations = dict(state.get("interpretations", {}))
    summaries = dict(interpretations.get("dimension_summaries", {}))
    texts = dict(interpretations.get("dimension_interpretations", {}))
    provenance = {
        dim_id: dict(record)
        for dim_id, record in state.get("generation_provenance", {}).items()
    }
    for dim_id in gaps:
        # The copy that was refused does not survive as evidence of anything.
        if capabilities.usesStructuredDimensionSummary:
            summaries[dim_id] = []
        texts[dim_id] = ""
        if dim_id in provenance:
            provenance[dim_id]["outcome"] = "unavailable"
            # Not the provider's fault: something was written and this service
            # refused it. The screens say different things about the two, so
            # the difference has to survive the trip.
            provenance[dim_id]["unavailableReason"] = "validation_rejected"

    interpretations["dimension_summaries"] = summaries
    interpretations["dimension_interpretations"] = texts
    return {
        **state,
        "interpretations": interpretations,
        "generation_provenance": provenance,
        "retry_interpretation_dimensions": [],
        "retry_recommendation_dimensions": [],
        "retry_overall_summary": False,
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
    """Final Formatter Node: assembles the analysis, then encodes it.

    What the run found is gathered here without a contract version in sight;
    which of it this deployment's version carries is `encode_stone_map`'s
    question and nobody else's.
    """
    round_data = state.get("round_data", {})
    contract_version = _effective_contract_version(round_data)
    analysis_input = CanonicalAnalysisInput.from_round_data(round_data)
    interpretations = state.get("interpretations", {})
    dimension_interpretations = interpretations.get(
        "dimension_interpretations",
        {},
    )
    dimension_summaries = interpretations.get("dimension_summaries", {})
    metric_insights = interpretations.get("metric_insights", {})
    recommendations = state.get("recommendations", {})
    generation_provenance = state.get("generation_provenance", {})

    stones: Dict[str, CanonicalStone] = {}
    for dimension_id, score in analysis_input.dimension_scores.items():
        aggregates = analysis_input.aggregates_for_dimension(dimension_id)
        if aggregates:
            metrics = [
                CanonicalMetric(
                    question_id=aggregate.question_id,
                    label=aggregate.question_text,
                    value=f"{aggregate.average_score:.1f} מתוך 100",
                    average_score=aggregate.average_score,
                    response_count=aggregate.response_count,
                    score_distribution=aggregate.score_distribution,
                    insight_text=metric_insights.get(dimension_id, {}).get(
                        aggregate.question_id,
                        "",
                    ),
                )
                for aggregate in aggregates
            ]
        else:
            # A dimension with no questions of its own still gets a readable
            # stone: three fixed lines about the dimension itself.
            metrics = [
                CanonicalMetric(
                    question_id=None,
                    label="ציון ממוצע",
                    value=f"{score.average_score:.1f}",
                ),
                CanonicalMetric(
                    question_id=None,
                    label="סטטוס מחוון",
                    value=score.computed_status.upper(),
                ),
                CanonicalMetric(
                    question_id=None,
                    label="רמת סיכון",
                    value=(
                        "גבוהה"
                        if score.computed_status == "red"
                        else "בינונית"
                        if score.computed_status == "yellow"
                        else "תקינה"
                    ),
                ),
            ]

        stones[dimension_id] = CanonicalStone(
            dimension_id=dimension_id,
            dimension_name_hebrew=DIMENSION_NAMES_HEBREW.get(
                dimension_id,
                dimension_id,
            ),
            status=score.computed_status,
            score=score.average_score,
            interpretation=dimension_interpretations.get(dimension_id, ""),
            summary=dimension_summaries.get(dimension_id, []),
            recommended_interventions=recommendations.get(dimension_id, []),
            metrics=metrics,
            generation_provenance=generation_provenance.get(dimension_id),
        )

    result = CanonicalAnalysisResult(
        round_id=analysis_input.round_id,
        survey_definition_hash=analysis_input.survey_definition_hash,
        overall_summary=interpretations.get("overall_summary", ""),
        overall_summary_outcome=interpretations.get("overall_summary_outcome"),
        stones=stones,
    )

    return {
        **state,
        "final_payload": encode_stone_map(result, contract_version),
    }

analytics_graph = AnalyticsGraphEngine()
