from dataclasses import dataclass, field, asdict
from typing import Dict, List, Literal, Optional, Any

DimensionStatus = Literal["green", "yellow", "red"]

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

    def to_dict(self) -> Dict[str, Any]:
        res = asdict(self)
        res["dimensionScores"] = {k: v.to_dict() if hasattr(v, "to_dict") else v for k, v in self.dimensionScores.items()}
        return res

    def model_dump(self) -> Dict[str, Any]:
        return self.to_dict()

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RoundAnalyticsResult":
        scores_raw = data.get("dimensionScores", {})
        scores = {}
        for k, v in scores_raw.items():
            if isinstance(v, dict):
                scores[k] = RoundDimensionScore.from_dict(v)
            elif isinstance(v, RoundDimensionScore):
                scores[k] = v

        return cls(
            roundId=data.get("roundId", ""),
            totalResponses=int(data.get("totalResponses", 0)),
            privacyThreshold=int(data.get("privacyThreshold", 10)),
            isLocked=bool(data.get("isLocked", False)),
            dimensionScores=scores,
            organizationContext=data.get("organizationContext", {})
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
    source: str
    title: str
    summary: str
    actionable_steps: List[str]

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
    roundId: str
    processedAt: str
    isLocked: bool
    status: Literal["success", "locked_error", "validation_failed"]
    errorMessage: Optional[str] = None
    overallPsychologicalSummary: Optional[str] = None
    stones: Dict[str, StoneDetail] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "roundId": self.roundId,
            "processedAt": self.processedAt,
            "isLocked": self.isLocked,
            "status": self.status,
            "errorMessage": self.errorMessage,
            "overallPsychologicalSummary": self.overallPsychologicalSummary,
            "stones": {k: v.to_dict() if hasattr(v, "to_dict") else v for k, v in self.stones.items()}
        }
