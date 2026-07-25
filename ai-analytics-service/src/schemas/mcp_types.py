from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Literal, Optional

from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_QUESTION_IDS,
    AI_ANALYTICS_QUESTIONS_BY_ID,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_V1_CONTRACT_VERSION,
)

DimensionStatus = Literal["green", "yellow", "red"]


def status_for_score(score: float) -> DimensionStatus:
    if score >= 75:
        return "green"
    if score >= 50:
        return "yellow"
    return "red"

@dataclass
class RoundDimensionScore:
    dimensionId: str
    averageScore: float
    computedStatus: DimensionStatus
    responseCount: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RoundDimensionScore":
        return cls(
            dimensionId=data.get("dimensionId", ""),
            averageScore=float(data.get("averageScore", 0.0)),
            computedStatus=data.get("computedStatus", "green"),
            responseCount=data.get("responseCount")
        )

@dataclass
class RoundAnalyticsResult:
    roundId: str
    totalResponses: int
    isLocked: bool
    dimensionScores: Dict[str, RoundDimensionScore]
    privacyThreshold: int = 10
    organizationContext: Optional[Dict[str, Any]] = field(default_factory=dict)
    contractVersion: str = AI_ANALYTICS_V1_CONTRACT_VERSION
    questionAggregates: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    calculatedAt: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        res = asdict(self)
        res["dimensionScores"] = {k: v.to_dict() if hasattr(v, "to_dict") else v for k, v in self.dimensionScores.items()}
        res["questionAggregates"] = {
            key: dict(value)
            for key, value in self.questionAggregates.items()
        }
        return res

    def model_dump(self) -> Dict[str, Any]:
        return self.to_dict()

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RoundAnalyticsResult":
        contract_version = data.get(
            "contractVersion",
            AI_ANALYTICS_V1_CONTRACT_VERSION,
        )
        if contract_version not in AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS:
            raise ValueError(
                "Unsupported AI analytics contract version "
                f"'{contract_version}'"
            )

        total_responses = int(data.get("totalResponses", 0))
        privacy_threshold = int(data.get("privacyThreshold", 10))
        if privacy_threshold < 1:
            raise ValueError("privacyThreshold must be a positive integer")

        is_locked = bool(data.get("isLocked", False)) or (
            total_responses < privacy_threshold
        )
        scores_raw = data.get("dimensionScores", {})
        scores = {}
        if not is_locked:
            for k, v in scores_raw.items():
                if isinstance(v, dict):
                    scores[k] = RoundDimensionScore.from_dict(v)
                elif isinstance(v, RoundDimensionScore):
                    scores[k] = v

        question_aggregates = {}
        if not is_locked:
            for question_id, aggregate in data.get(
                "questionAggregates",
                {},
            ).items():
                if not isinstance(aggregate, dict):
                    raise ValueError(
                        f"Question aggregate '{question_id}' must be an object"
                    )
                raw_response_count = aggregate.get("responseCount", 0)
                if (
                    contract_version == AI_ANALYTICS_CONTRACT_VERSION
                    and (
                        not isinstance(raw_response_count, int)
                        or isinstance(raw_response_count, bool)
                    )
                ):
                    raise ValueError(
                        f"Question aggregate '{question_id}' responseCount "
                        "must be an integer"
                    )
                question_aggregates[question_id] = {
                    "questionId": aggregate.get("questionId", question_id),
                    "dimensionId": aggregate.get("dimensionId", ""),
                    "questionTextHebrew": aggregate.get(
                        "questionTextHebrew",
                        "",
                    ),
                    "averageScore": float(
                        aggregate.get("averageScore", 0.0),
                    ),
                    "responseCount": int(
                        raw_response_count,
                    ),
                }

        if contract_version == AI_ANALYTICS_CONTRACT_VERSION and not is_locked:
            cls._validate_v2_aggregates(
                scores,
                question_aggregates,
                privacy_threshold,
                total_responses,
            )
        if contract_version == AI_ANALYTICS_CONTRACT_VERSION and not (
            isinstance(data.get("calculatedAt"), str)
            and data["calculatedAt"].strip()
        ):
            raise ValueError(
                "AI analytics contract 2.0 requires calculatedAt"
            )

        return cls(
            roundId=data.get("roundId", ""),
            totalResponses=total_responses,
            privacyThreshold=privacy_threshold,
            isLocked=is_locked,
            dimensionScores=scores,
            organizationContext=data.get("organizationContext", {}),
            contractVersion=contract_version,
            questionAggregates=question_aggregates,
            calculatedAt=data.get("calculatedAt"),
        )

    @staticmethod
    def _validate_v2_aggregates(
        scores: Dict[str, RoundDimensionScore],
        question_aggregates: Dict[str, Dict[str, Any]],
        privacy_threshold: int,
        total_responses: int,
    ) -> None:
        if set(scores) != set(AI_ANALYTICS_DIMENSION_IDS):
            raise ValueError(
                "AI analytics contract 2.0 requires exactly eight "
                "canonical dimension scores"
            )

        for dimension_id, score in scores.items():
            if score.dimensionId != dimension_id:
                raise ValueError(
                    f"Dimension score key mismatch for '{dimension_id}'"
                )
            if not 0 <= score.averageScore <= 100:
                raise ValueError(
                    f"Dimension score '{dimension_id}' is outside 0..100"
                )
            expected_status = status_for_score(score.averageScore)
            if score.computedStatus != expected_status:
                raise ValueError(
                    f"Dimension status '{dimension_id}' is inconsistent "
                    "with its score"
                )

        if set(question_aggregates) != set(AI_ANALYTICS_QUESTION_IDS):
            raise ValueError(
                "AI analytics contract 2.0 requires exactly 24 canonical "
                "question aggregates"
            )

        for question_id, aggregate in question_aggregates.items():
            canonical = AI_ANALYTICS_QUESTIONS_BY_ID[question_id]
            if (
                aggregate["questionId"] != question_id
                or aggregate["dimensionId"] != canonical["dimensionId"]
                or aggregate["questionTextHebrew"]
                != canonical["textHebrew"]
            ):
                raise ValueError(
                    f"Question aggregate '{question_id}' is not canonical"
                )
            if not 0 <= aggregate["averageScore"] <= 100:
                raise ValueError(
                    f"Question aggregate '{question_id}' is outside 0..100"
                )
            if aggregate["responseCount"] < 1:
                raise ValueError(
                    f"Question aggregate '{question_id}' must have responses"
                )
            if aggregate["responseCount"] < privacy_threshold:
                raise ValueError(
                    f"Question aggregate '{question_id}' responseCount is "
                    "below privacyThreshold"
                )
            if aggregate["responseCount"] > total_responses:
                raise ValueError(
                    f"Question aggregate '{question_id}' responseCount "
                    "exceeds totalResponses"
                )

@dataclass
class StoneMetric:
    label: str
    value: str
    trend: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class StoneIntervention:
    id: str
    dimensionId: str
    source: str
    title: str
    summary: str
    actionable_steps: List[str]
    status: Optional[DimensionStatus] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def model_dump(self) -> Dict[str, Any]:
        return self.to_dict()

@dataclass
class StoneDetail:
    dimensionId: str
    dimensionNameHebrew: str
    status: DimensionStatus
    score: float
    psychologicalInterpretation: str
    recommendedInterventions: List[StoneIntervention]
    metrics: List[StoneMetric]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dimensionId": self.dimensionId,
            "dimensionNameHebrew": self.dimensionNameHebrew,
            "status": self.status,
            "score": self.score,
            "psychologicalInterpretation": self.psychologicalInterpretation,
            "recommendedInterventions": [i.to_dict() if hasattr(i, "to_dict") else i for i in self.recommendedInterventions],
            "metrics": [m.to_dict() if hasattr(m, "to_dict") else m for m in self.metrics]
        }

@dataclass
class StoneMapResult:
    contractVersion: str
    roundId: str
    processedAt: str
    isLocked: bool
    status: Literal["success", "locked_error", "validation_failed"]
    errorMessage: Optional[str] = None
    overallPsychologicalSummary: Optional[str] = None
    stones: Dict[str, StoneDetail] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "contractVersion": self.contractVersion,
            "roundId": self.roundId,
            "processedAt": self.processedAt,
            "isLocked": self.isLocked,
            "status": self.status,
            "errorMessage": self.errorMessage,
            "overallPsychologicalSummary": self.overallPsychologicalSummary,
            "stones": {k: v.to_dict() if hasattr(v, "to_dict") else v for k, v in self.stones.items()}
        }
