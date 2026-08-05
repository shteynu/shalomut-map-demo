import json
import logging

from src.agents.node_support import (
    V5_PROMPT_INCLUSION_FIELDS,
    _effective_contract_version,
    _question_aggregates_for_dimension,
    _v5_prompt_inclusions,
)
from src.agents.safety_report import SafetyViolation, violation
from src.agents.state import AnalyticsState
from src.schemas.contract_registry import get_capabilities
from src.schemas.mcp_types import status_for_score
from src.schemas.stone_map_validation import has_valid_unavailable_reason
from src.services import hebrew_validation


logger = logging.getLogger(__name__)


def agent_safety_validator_node(state: AnalyticsState) -> AnalyticsState:
    """Validate status, Hebrew copy, provenance and intervention boundaries."""
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    interpretations = state.get("interpretations", {}).get(
        "dimension_interpretations",
        {},
    )
    dimension_summaries = state.get("interpretations", {}).get(
        "dimension_summaries",
        {},
    )
    metric_insights = state.get("interpretations", {}).get(
        "metric_insights",
        {},
    )
    overall_summary = state.get("interpretations", {}).get(
        "overall_summary",
        "",
    )
    retry_count = state.get("retry_count", 0)
    contract_version = _effective_contract_version(round_data)
    capabilities = get_capabilities(contract_version)
    is_semantic_contract = capabilities.isSemanticContract
    is_dynamic_contract = capabilities.supportsDynamicQuestions

    is_safe = True
    feedback = []
    violations: list[SafetyViolation] = []
    rejected_interpretations = set()
    rejected_recommendations = set()
    rejected_summary = False

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = float(score_obj.get("averageScore", 0.0))
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = float(getattr(score_obj, "averageScore", 0.0))

        interp = interpretations.get(dim_id, "")

        if status != status_for_score(score):
            is_safe = False
            rejected_interpretations.add(dim_id)
            feedback.append(
                f"Status is inconsistent with score for {dim_id}"
            )
            violations.append(
                violation("status_inconsistent", "interpretation", dim_id),
            )

        distribution_counts = hebrew_validation.distribution_counts(
            _question_aggregates_for_dimension(round_data, dim_id),
        )
        unavailable = (
            state.get("generation_provenance", {})
            .get(dim_id, {})
            .get("outcome") == "unavailable"
        )
        if capabilities.usesStructuredDimensionSummary:
            summaries = dimension_summaries.get(dim_id, [])
            parsed_summary = hebrew_validation.parse_v6_structured_summary(
                json.dumps(summaries, ensure_ascii=False),
                status=status,
            )
            expected_metrics = _question_aggregates_for_dimension(
                round_data,
                dim_id,
            )
            narratives = metric_insights.get(dim_id, {})
            metric_copy_valid = (
                set(narratives)
                == {item["questionId"] for item in expected_metrics}
                and all(
                    hebrew_validation.is_v6_qualitative_narrative(text)
                    and hebrew_validation.is_status_consistent(text, status)
                    for text in narratives.values()
                )
            )
            # A V6 gap covers the three overview paragraphs and nothing else.
            # The metric narratives are still required, because a dimension
            # that lost its overview can still say what each question means —
            # and because Core refuses a metric without one either way.
            summary_valid = (
                summaries == [] if unavailable else parsed_summary is not None
            )
            if not summary_valid or not metric_copy_valid:
                is_safe = False
                rejected_interpretations.add(dim_id)
                feedback.append(
                    f"An unavailable overview must be empty: {dim_id}"
                    if unavailable
                    else f"Structured V6 narrative is invalid for {dim_id}"
                )
                violations.append(
                    violation(
                        "unavailable_not_empty" if unavailable
                        else "v6_narrative_invalid",
                        "interpretation",
                        dim_id,
                    ),
                )
        elif unavailable:
            if interp != "":
                is_safe = False
                rejected_interpretations.add(dim_id)
                feedback.append(
                    f"An unavailable interpretation must be empty: {dim_id}"
                )
                violations.append(
                    violation("unavailable_not_empty", "interpretation", dim_id),
                )
        elif (
            not hebrew_validation.is_complete_hebrew_copy(
                interp,
                contract_version=contract_version,
            )
            or not hebrew_validation.is_status_consistent(
                interp,
                status,
                contract_version=contract_version,
                distribution_counts=distribution_counts,
            )
        ):
            is_safe = False
            rejected_interpretations.add(dim_id)
            feedback.append(
                f"Interpretation is invalid for status {status}: {dim_id}"
            )
            violations.append(
                violation("interpretation_invalid", "interpretation", dim_id),
            )

        dimension_interventions = state.get("recommendations", {}).get(
            dim_id,
            [],
        )
        if (
            capabilities.usesStructuredDimensionSummary
            and len(dimension_interventions) != 5
        ):
            is_safe = False
            rejected_recommendations.add(dim_id)
            feedback.append(
                f"V6 requires five interventions for {dim_id}"
            )
            violations.append(
                violation("v6_intervention_count", "recommendation", dim_id),
            )
        for intervention in dimension_interventions:
            user_facing_copy = [
                intervention.get("title", ""),
                intervention.get("summary", ""),
                *intervention.get("actionable_steps", []),
            ]
            adaptation_outcome = intervention.get("adaptationOutcome")
            if (
                intervention.get("dimensionId") != dim_id
                or intervention.get("status") != status
                or not user_facing_copy
                or not all(
                    hebrew_validation.is_hebrew_only_copy(text)
                    for text in user_facing_copy
                )
                or (
                    capabilities.supportsAdaptationOutcome
                    and adaptation_outcome
                    not in {"llm", "deterministic_fallback"}
                )
                or (
                    adaptation_outcome == "llm"
                    and not hebrew_validation.is_status_consistent(
                        " ".join(user_facing_copy),
                        status,
                        contract_version=contract_version,
                        distribution_counts=distribution_counts,
                    )
                )
                or (
                    capabilities.usesStructuredDimensionSummary
                    and not hebrew_validation.is_v6_qualitative_narrative(
                        intervention.get("summary", ""),
                    )
                )
            ):
                is_safe = False
                rejected_recommendations.add(dim_id)
                feedback.append(
                    f"Intervention is invalid for status {status}: {dim_id}"
                )
                violations.append(
                    violation("intervention_invalid", "recommendation", dim_id),
                )

        if is_semantic_contract:
            provenance = state.get("generation_provenance", {}).get(
                dim_id,
                {},
            )
            expected_question_ids = [
                aggregate["questionId"]
                for aggregate in _question_aggregates_for_dimension(
                    round_data,
                    dim_id,
                )
            ]
            attempts = provenance.get("attempts")
            retry_count_value = provenance.get("retryCount")
            outcome = provenance.get("outcome")
            allowed_outcomes = {"llm", "deterministic_fallback"}
            if capabilities.supportsPartialMaps:
                allowed_outcomes.add("unavailable")
            if (
                outcome not in allowed_outcomes
                or not isinstance(attempts, int)
                or isinstance(attempts, bool)
                or attempts < 0
                or not isinstance(retry_count_value, int)
                or isinstance(retry_count_value, bool)
                or retry_count_value != max(0, attempts - 1)
                or provenance.get("sourceQuestionIds")
                != expected_question_ids
                or (
                    is_dynamic_contract
                    and provenance.get("surveyDefinitionHash")
                    != round_data.get("surveyDefinitionHash")
                )
                or (outcome == "llm" and attempts < 1)
                or not has_valid_unavailable_reason(provenance)
                or (
                    capabilities.supportsScoreDistribution
                    and {
                        field: provenance.get(field)
                        for field in V5_PROMPT_INCLUSION_FIELDS
                    }
                    != _v5_prompt_inclusions(
                        round_data,
                        dim_id,
                        dim_scores,
                    )
                )
            ):
                is_safe = False
                rejected_interpretations.add(dim_id)
                feedback.append(
                    f"Generation provenance is invalid for {dim_id}"
                )
                violations.append(
                    violation("provenance_invalid", "interpretation", dim_id),
                )

    if is_semantic_contract and not hebrew_validation.is_hebrew_only_copy(
        overall_summary,
    ):
        is_safe = False
        rejected_summary = True
        feedback.append("Overall summary is not Hebrew-only")
        violations.append(
            violation("overall_summary_not_hebrew", "overall_summary"),
        )

    if not is_safe:
        next_retry_count = min(3, retry_count + 1)
        logger.warning(
            "[Safety Validator] Safety check failed. Retry count: %s. "
            "Replaying interpretations=%s recommendations=%s summary=%s",
            next_retry_count,
            ",".join(sorted(rejected_interpretations)) or "-",
            ",".join(sorted(rejected_recommendations)) or "-",
            "yes" if rejected_summary else "no",
        )
        return {
            **state,
            "safety_status": "fail",
            "safety_feedback": "; ".join(feedback),
            "safety_violations": violations,
            "retry_count": next_retry_count,
            "retry_interpretation_dimensions": sorted(
                rejected_interpretations,
            ),
            "retry_recommendation_dimensions": sorted(
                rejected_recommendations,
            ),
            "retry_overall_summary": rejected_summary,
        }

    return {
        **state,
        "safety_status": "pass",
        "safety_feedback": None,
        "safety_violations": [],
    }
