"""Version-free models of one analysis round.

The mirror of `src/lib/types/canonical-analytics.ts` in Core: what the round is
and what the run produced, with no contract version anywhere. Which of it a
given version carries is asked once, in `src/schemas/analytics_output.py`.

The input side is a read model over the already-validated MCP payload rather
than a second parse. `mcp_types.RoundAnalyticsResult.from_dict` remains the one
place that decides whether a payload is acceptable; this only gives the graph a
shape it can read without asking which version it came from.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from src.contracts import AI_ANALYTICS_QUESTIONS, AI_ANALYTICS_V1_CONTRACT_VERSION
from src.schemas.contract_registry import get_capabilities


@dataclass(frozen=True)
class CanonicalQuestionAggregate:
    """One question of the round as Core measured it.

    `question_text` is the one name for what two contract generations spell
    `questionText` and `questionTextHebrew`.
    """

    question_id: str
    dimension_id: str
    question_text: str
    average_score: float
    response_count: int
    score_distribution: Optional[Dict[str, int]] = None


@dataclass(frozen=True)
class CanonicalDimensionScore:
    dimension_id: str
    average_score: float
    computed_status: str


@dataclass(frozen=True)
class CanonicalAnalysisInput:
    """The round the graph works on, without its wire version."""

    round_id: str
    survey_definition_hash: Optional[str]
    is_locked: bool
    dimension_scores: Dict[str, CanonicalDimensionScore]
    question_aggregates: List[CanonicalQuestionAggregate]
    background_context: Dict[str, Any] = field(default_factory=dict)

    def aggregates_for_dimension(
        self,
        dimension_id: str,
    ) -> List[CanonicalQuestionAggregate]:
        return [
            aggregate
            for aggregate in self.question_aggregates
            if aggregate.dimension_id == dimension_id
        ]

    @classmethod
    def from_round_data(
        cls,
        round_data: Dict[str, Any],
    ) -> "CanonicalAnalysisInput":
        contract_version = round_data.get(
            "contractVersion",
            AI_ANALYTICS_V1_CONTRACT_VERSION,
        )
        capabilities = get_capabilities(contract_version)
        raw_aggregates = round_data.get("questionAggregates", {}) or {}

        if capabilities.supportsDynamicQuestions:
            # A dynamic round owns its own questions, in the order Core sent
            # them, and every aggregate names its own dimension.
            ordered = [
                (aggregate, aggregate.get("dimensionId", ""))
                for aggregate in raw_aggregates.values()
                if isinstance(aggregate, dict)
            ]
        else:
            # The canonical questionnaire owns both the order and the
            # dimension of a legacy round, so a payload that never spelled
            # `dimensionId` still lands on the right stone.
            ordered = [
                (raw_aggregates[question["id"]], question["dimensionId"])
                for question in AI_ANALYTICS_QUESTIONS
                if isinstance(raw_aggregates.get(question["id"]), dict)
            ]

        aggregates = [
            CanonicalQuestionAggregate(
                question_id=aggregate.get("questionId", ""),
                dimension_id=aggregate.get("dimensionId") or dimension_id,
                question_text=(
                    aggregate.get("questionText")
                    or aggregate.get("questionTextHebrew")
                    or ""
                ),
                average_score=float(aggregate.get("averageScore", 0.0)),
                response_count=int(aggregate.get("responseCount", 0)),
                score_distribution=(
                    dict(aggregate["scoreDistribution"])
                    if isinstance(aggregate.get("scoreDistribution"), dict)
                    else None
                ),
            )
            for aggregate, dimension_id in ordered
        ]

        dimension_scores = {}
        for dimension_id, score in (
            round_data.get("dimensionScores", {}) or {}
        ).items():
            if isinstance(score, dict):
                average_score = score.get("averageScore", 0.0)
                computed_status = score.get("computedStatus", "green")
            else:
                average_score = getattr(score, "averageScore", 0.0)
                computed_status = getattr(score, "computedStatus", "green")
            dimension_scores[dimension_id] = CanonicalDimensionScore(
                dimension_id=dimension_id,
                average_score=average_score,
                computed_status=computed_status,
            )

        return cls(
            round_id=round_data.get("roundId", ""),
            survey_definition_hash=round_data.get("surveyDefinitionHash"),
            is_locked=bool(round_data.get("isLocked", False)),
            dimension_scores=dimension_scores,
            question_aggregates=aggregates,
            background_context=round_data.get("backgroundContext") or {},
        )


@dataclass
class CanonicalMetric:
    """One question's line on a stone, before a version names its fields."""

    question_id: Optional[str]
    label: str
    value: str
    average_score: Optional[float] = None
    response_count: Optional[int] = None
    score_distribution: Optional[Dict[str, int]] = None
    insight_text: str = ""


@dataclass
class CanonicalStone:
    """Everything the run produced for one dimension.

    Both `interpretation` and `summary` live here because different contract
    generations ask the model for different copy; the adapter sends whichever
    the target version carries. Whether a node was asked to write the other one
    at all is a generation decision and stays with the nodes — a contract that
    will not carry the copy should not be paying a provider for it.
    """

    dimension_id: str
    dimension_name_hebrew: str
    status: str
    score: float
    interpretation: str = ""
    summary: List[str] = field(default_factory=list)
    recommended_interventions: List[Any] = field(default_factory=list)
    metrics: List[CanonicalMetric] = field(default_factory=list)
    generation_provenance: Optional[Dict[str, Any]] = None


@dataclass
class CanonicalAnalysisResult:
    """The finished analysis of one round, before it becomes a Stone Map."""

    round_id: str
    survey_definition_hash: Optional[str]
    overall_summary: str
    stones: Dict[str, CanonicalStone] = field(default_factory=dict)
    # Who wrote `overall_summary`. `None` for a version too old to say, and for
    # a run that predates the field — the encoder is what decides whether a
    # given contract may put it on the wire at all.
    overall_summary_outcome: Optional[str] = None
