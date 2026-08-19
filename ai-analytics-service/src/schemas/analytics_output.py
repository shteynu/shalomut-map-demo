"""The Stone Map as one contract version describes it.

The output half of stage 3, mirroring `src/lib/analytics-encoder.ts` in Core:
the graph produces a `CanonicalAnalysisResult` that says everything the run
found, and this module answers, once, which of it the target version carries —
whether a dimension travels as a structured `summary` or as one
`psychologicalInterpretation`, whether a metric keeps its distribution or its
narrative insight, whether the map may name the dimensions it could not write.

A contract version decides what is sent, never what is true.
"""

from datetime import datetime, timezone
from typing import Any, Dict

from src.contracts import AI_ANALYTICS_DIMENSION_IDS
from src.schemas.canonical import (
    CanonicalAnalysisInput,
    CanonicalAnalysisResult,
    CanonicalMetric,
)
from src.schemas.contract_registry import get_capabilities


def _processed_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def _encode_metric(
    metric: CanonicalMetric,
    *,
    capabilities,
) -> Dict[str, Any]:
    encoded: Dict[str, Any] = {}
    if metric.question_id is not None:
        encoded["questionId"] = metric.question_id
    encoded["label"] = metric.label
    encoded["value"] = metric.value
    if metric.average_score is not None:
        encoded["averageScore"] = metric.average_score
    if metric.response_count is not None:
        encoded["responseCount"] = metric.response_count
    # 5.0 carries the distribution back out exactly as it came in, never
    # recomputed: Core owns these numbers and has something to check them
    # against.
    if capabilities.supportsScoreDistribution and metric.score_distribution:
        encoded["scoreDistribution"] = dict(metric.score_distribution)
    # Only a metric that stands for a real question can carry an insight; the
    # three fixed lines a dimension falls back to have no question to speak of.
    if capabilities.usesNarrativeMetrics and metric.question_id is not None:
        encoded["insightText"] = metric.insight_text
    return encoded


def encode_stone_map(
    result: CanonicalAnalysisResult,
    contract_version: str,
) -> Dict[str, Any]:
    """Encode a finished analysis as the Stone Map payload Core will read."""
    capabilities = get_capabilities(contract_version)

    if capabilities.supportsDynamicQuestions and set(result.stones) != set(
        AI_ANALYTICS_DIMENSION_IDS,
    ):
        raise ValueError(
            "AI analytics contract 3.0 requires exactly eight stones"
        )

    stones: Dict[str, Any] = {}
    for dimension_id, stone in result.stones.items():
        encoded = {
            "dimensionId": stone.dimension_id,
            "dimensionNameHebrew": stone.dimension_name_hebrew,
            "status": stone.status,
            "score": stone.score,
            "recommendedInterventions": stone.recommended_interventions,
            "metrics": [
                _encode_metric(metric, capabilities=capabilities)
                for metric in stone.metrics
            ],
        }
        if capabilities.usesStructuredDimensionSummary:
            encoded["summary"] = stone.summary
        else:
            encoded["psychologicalInterpretation"] = stone.interpretation
        if capabilities.isSemanticContract:
            if stone.generation_provenance is None:
                raise ValueError(
                    f"Missing generation provenance for '{dimension_id}'"
                )
            encoded["generationProvenance"] = stone.generation_provenance
        stones[dimension_id] = encoded

    payload: Dict[str, Any] = {
        "contractVersion": contract_version,
        "roundId": result.round_id,
        "processedAt": _processed_at(),
        "isLocked": False,
        "status": "success",
        "overallPsychologicalSummary": result.overall_summary,
        "stones": stones,
    }
    # Optional and only where the contract can say it: `4.0` and earlier never
    # ask the model for this sentence, so the field would describe a choice
    # the version does not make. Mirrors `metricInsightsOutcome` — one round-
    # level fact instead of eight per-dimension ones, but the same rule.
    if (
        capabilities.usesStructuredDimensionSummary
        and result.overall_summary_outcome is not None
    ):
        payload["overallSummaryOutcome"] = result.overall_summary_outcome
    if capabilities.supportsDynamicQuestions:
        payload["surveyDefinitionHash"] = result.survey_definition_hash
    if capabilities.supportsPartialMaps:
        # Stated whenever the map is partial, and omitted when it is whole, so
        # a full round's payload is byte-identical to what it was before the
        # partial map existed. Core requires this list to agree exactly with
        # the stones: a banner that disagrees with the map is how a manager
        # stops trusting the screen.
        gaps = sorted(
            dimension_id
            for dimension_id, stone in result.stones.items()
            if (stone.generation_provenance or {}).get("outcome")
            == "unavailable"
        )
        if gaps:
            payload["dimensionsWithoutInterpretation"] = gaps

    return payload


def encode_locked(
    analysis_input: CanonicalAnalysisInput,
    contract_version: str,
    *,
    privacy_threshold: int,
) -> Dict[str, Any]:
    """The shape a round travels in when the privacy gate closed on it.

    A locked round says only that it is locked and how many respondents it
    would take to unlock. Nothing about the dimensions, the questions or the
    school crosses the boundary, because the reading would describe the few
    people who did answer.
    """
    capabilities = get_capabilities(contract_version)
    dynamic_metadata = (
        {"surveyDefinitionHash": analysis_input.survey_definition_hash}
        if capabilities.supportsDynamicQuestions
        else {}
    )
    return {
        "contractVersion": contract_version,
        "roundId": analysis_input.round_id,
        **dynamic_metadata,
        "isLocked": True,
        "status": "locked_error",
        "errorMessage": (
            "תוצאות מפורטות נעולות עד להשלמת סף הפרטיות "
            f"של {privacy_threshold} משיבים."
        ),
    }


def encode_failure(
    analysis_input: CanonicalAnalysisInput,
    contract_version: str,
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
    capabilities = get_capabilities(contract_version)
    dynamic_metadata = (
        {"surveyDefinitionHash": analysis_input.survey_definition_hash}
        if capabilities.supportsDynamicQuestions
        else {}
    )
    return {
        "contractVersion": contract_version,
        "roundId": analysis_input.round_id,
        **dynamic_metadata,
        "processedAt": _processed_at(),
        "isLocked": False,
        "status": "validation_failed",
        "failureReason": failure_reason,
        "errorMessage": error_message,
    }
