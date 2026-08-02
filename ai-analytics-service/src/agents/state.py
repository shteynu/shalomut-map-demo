from typing import Any, Dict, List, Literal, NotRequired, TypedDict

from src.agents.safety_report import SafetyViolation


class DimensionScoreState(TypedDict):
    averageScore: float
    computedStatus: Literal["green", "yellow", "red"]


class QuestionAggregateState(TypedDict, total=False):
    questionId: str
    dimensionId: str
    questionText: str
    questionTextHebrew: str
    averageScore: float
    computedStatus: Literal["green", "yellow", "red"]
    responseCount: int
    scoreDistribution: Dict[str, int]


class RoundAnalyticsState(TypedDict, total=False):
    """Versioned MCP input after schema validation.

    Fields that differ between immutable contract versions stay optional here;
    their exact required/forbidden rules belong to ``mcp_types.py`` and the
    shared manifests, not to the graph's evolving state.
    """

    contractVersion: str
    roundId: str
    isLocked: bool
    totalResponses: int
    privacyThreshold: int
    surveyDefinitionHash: str
    dimensionScores: Dict[str, DimensionScoreState]
    questionAggregates: Dict[str, QuestionAggregateState]
    backgroundContext: Dict[str, Any]


class InterpretationState(TypedDict):
    overall_summary: str
    dimension_interpretations: Dict[str, str]
    dimension_summaries: NotRequired[Dict[str, list[str]]]
    metric_insights: NotRequired[Dict[str, Dict[str, str]]]


class GenerationProvenanceState(TypedDict, total=False):
    outcome: Literal["llm", "deterministic_fallback", "unavailable"]
    attempts: int
    retryCount: int
    sourceQuestionIds: List[str]
    surveyDefinitionHash: str
    backgroundContextIncluded: bool
    distributionIncluded: bool
    crossDimensionContextIncluded: bool


class InterventionState(TypedDict, total=False):
    dimensionId: str
    status: Literal["green", "yellow", "red"]
    title: str
    summary: str
    actionable_steps: List[str]
    adaptationOutcome: Literal["llm", "deterministic_fallback"]


class AnalyticsState(TypedDict, total=False):
    """Typed state shared by the graph nodes.

    The graph enriches the state one node at a time, so every field is optional
    at the container level. Each node owns the presence of the fields it writes;
    nested records use named types instead of anonymous ``Dict[str, Any]``.
    """

    round_data: RoundAnalyticsState
    org_context: Dict[str, Any]
    interpretations: InterpretationState
    generation_provenance: Dict[str, GenerationProvenanceState]
    recommendations: Dict[str, List[InterventionState]]
    safety_status: Literal[
        "pass_privacy",
        "pass",
        "fail",
        "privacy_locked",
        "provider_unavailable",
    ]
    safety_feedback: str | None
    # The same refusals as `safety_feedback`, coded so the replay can turn them
    # into a critique for the prompt instead of only logging a sentence.
    safety_violations: List[SafetyViolation]
    provider_failure_reason: str
    retry_count: int
    retry_interpretation_dimensions: List[str]
    retry_recommendation_dimensions: List[str]
    retry_overall_summary: bool
    final_payload: Dict[str, Any]
