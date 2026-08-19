from typing import (
    Any,
    Dict,
    Iterable,
    List,
    Literal,
    NotRequired,
    Optional,
    TypedDict,
)

from src.agents.safety_report import SafetyViolation


# Every value `safety_status` takes, including the one a round starts on.
# `pending` was missing here while both entrypoints wrote it, which nothing
# caught: no type checker runs over this service, so the state contract is
# only as true as the tests that read it. `test_agent_state_contract.py` reads
# this alias and the assignments in `src/`, and fails when they disagree.
SafetyStatus = Literal[
    "pending",
    "pass_privacy",
    "pass",
    "fail",
    "privacy_locked",
    "provider_unavailable",
]


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
    # Who wrote the round's opening sentence — the one round-level provenance
    # field, sitting beside `overall_summary` for the same reason the stones'
    # `outcome` sits beside their own copy. Optional because it is only
    # meaningful on a contract that can fall back here at all: `4.0` and
    # earlier never ask the model, and `5.0` raises rather than falling back,
    # so neither ever writes this key.
    overall_summary_outcome: NotRequired[Literal["llm", "deterministic_fallback"]]


class GenerationProvenanceState(TypedDict, total=False):
    outcome: Literal["llm", "deterministic_fallback", "unavailable"]
    # The metric narratives of one dimension are written in a single
    # exact-coverage call, so they share one outcome. `outcome` above is the
    # dimension's summary and says nothing about them: a stone can carry
    # model-written paragraphs beside derived metric narratives.
    metricInsightsOutcome: Literal["llm", "deterministic_fallback"]
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
    safety_status: SafetyStatus
    safety_feedback: str | None
    # The same refusals as `safety_feedback`, coded so the replay can turn them
    # into a critique for the prompt instead of only logging a sentence.
    safety_violations: List[SafetyViolation]
    provider_failure_reason: str
    retry_count: int
    retry_interpretation_dimensions: List[str]
    retry_recommendation_dimensions: List[str]
    retry_overall_summary: bool
    # The dimensions a partial run has to write again, named by Core. Empty or
    # absent on an ordinary run, which analyses the whole round. It is not a
    # retry: nothing failed, and the copy the other dimensions keep is copy the
    # model already wrote and the validator already accepted.
    regenerate_dimension_ids: List[str]
    final_payload: Dict[str, Any]


def carried_state_from_result(
    previous_result: Dict[str, Any],
    keep_dimension_ids: Iterable[str],
) -> Dict[str, Any]:
    """Turn a stored Stone Map back into the state that produced its copy.

    Only the writing is carried — the paragraphs, the metric sentences, the
    recommendations and who wrote each of them. Every number is deliberately
    left behind: the formatter recomputes score, status and each metric's
    aggregate from this run's own `round_data`, so a carried dimension is last
    round's words over today's figures rather than a stale stone copied whole.
    Core would refuse the stale one anyway — it recomputes the same numbers
    before it stores anything — and on a closed round, which is the only kind
    this runs for, the two agree.

    A dimension the previous map has no stone for is skipped rather than
    invented: it is then simply regenerated, which is the right answer.
    """
    stones = previous_result.get("stones") or {}
    interpretations: Dict[str, str] = {}
    summaries: Dict[str, list] = {}
    metric_insights: Dict[str, Dict[str, str]] = {}
    recommendations: Dict[str, Any] = {}
    provenance: Dict[str, Any] = {}

    for dimension_id in keep_dimension_ids:
        stone = stones.get(dimension_id)
        if not isinstance(stone, dict):
            continue

        # `psychologicalInterpretation` up to 5.0, `summary` from 6.0. Both are
        # read rather than the version being consulted: a map carries whichever
        # its own version produced, and this has to work for the map in hand.
        if stone.get("psychologicalInterpretation"):
            interpretations[dimension_id] = stone["psychologicalInterpretation"]
        if stone.get("summary"):
            summaries[dimension_id] = list(stone["summary"])
        insights = {
            metric["questionId"]: metric.get("insightText", "")
            for metric in stone.get("metrics") or []
            if isinstance(metric, dict) and metric.get("questionId")
        }
        if insights:
            metric_insights[dimension_id] = insights
        if stone.get("recommendedInterventions"):
            recommendations[dimension_id] = [
                dict(intervention)
                for intervention in stone["recommendedInterventions"]
            ]
        # The provenance is what makes the skip work at all: a node passes over
        # a dimension only when the state already says who wrote it. Carrying
        # it also keeps the disclosure honest — a dimension the previous run
        # fell back on still reads as fallen back until a run rewrites it.
        if isinstance(stone.get("generationProvenance"), dict):
            provenance[dimension_id] = dict(stone["generationProvenance"])

    return {
        "interpretations": {
            "dimension_interpretations": interpretations,
            "dimension_summaries": summaries,
            "metric_insights": metric_insights,
        },
        "recommendations": recommendations,
        "generation_provenance": provenance,
    }


def build_initial_state(
    *,
    round_data: Dict[str, Any],
    org_context: Dict[str, Any],
    regenerate_dimension_ids: Optional[Iterable[str]] = None,
    previous_result: Optional[Dict[str, Any]] = None,
) -> AnalyticsState:
    """The state a round starts on, written once instead of at each entrypoint.

    `AnalyticsRunner` and `pipeline_cli` used to spell the same eight keys out
    separately, which is how one of them could drift without the other and how
    `safety_status` came to start on a value its own type did not list.

    A partial run starts on more than that: the dimensions it does not name
    begin with the copy the previous map already carries, so the nodes skip
    them the same way a targeted replay does. Without a previous map there is
    nothing to carry and the run is an ordinary whole-round one — Core refuses
    to queue that combination, and this stays correct if anything ever does.
    """
    requested = list(regenerate_dimension_ids or ())
    carried: Dict[str, Any] = {
        "interpretations": {},
        "recommendations": {},
    }
    if requested and previous_result:
        carried = carried_state_from_result(
            previous_result,
            [
                dimension_id
                for dimension_id in (previous_result.get("stones") or {})
                if dimension_id not in requested
            ],
        )

    return {
        "round_data": round_data,
        "org_context": org_context,
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "regenerate_dimension_ids": requested if previous_result else [],
        "final_payload": {},
        **carried,
    }
