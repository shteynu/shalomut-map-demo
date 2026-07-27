from dataclasses import asdict, dataclass, field
import hashlib
import json
import math
import re
from typing import Any, Dict, List, Literal, Optional

from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
    AI_ANALYTICS_QUESTION_IDS,
    AI_ANALYTICS_QUESTIONS_BY_ID,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_V1_CONTRACT_VERSION,
)

DimensionStatus = Literal["green", "yellow", "red"]

_SURVEY_DEFINITION_HASH_PATTERN = re.compile(r"^sha256:[a-f0-9]{64}$")
_HEBREW_PATTERN = re.compile(r"[\u0590-\u05ff]")
_LATIN_PATTERN = re.compile(r"[A-Za-z]")
_V3_FORBIDDEN_FIELDS = frozenset(
    {
        "respondentId",
        "respondentName",
        "email",
        "anonymousTokenHash",
        "responseId",
        "answers",
        "submittedAt",
    },
)


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
    privacyThreshold: int = 1
    organizationContext: Optional[Dict[str, Any]] = field(default_factory=dict)
    contractVersion: str = AI_ANALYTICS_V1_CONTRACT_VERSION
    questionAggregates: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    calculatedAt: Optional[str] = None
    organizationId: Optional[str] = None
    surveyDefinitionHash: Optional[str] = None
    backgroundContext: Optional[Dict[str, Any]] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        res = asdict(self)
        res["dimensionScores"] = {k: v.to_dict() if hasattr(v, "to_dict") else v for k, v in self.dimensionScores.items()}
        res["questionAggregates"] = {
            key: dict(value)
            for key, value in self.questionAggregates.items()
        }
        if self.organizationId is None:
            res.pop("organizationId")
        if self.surveyDefinitionHash is None:
            res.pop("surveyDefinitionHash")
        return res

    def model_dump(self) -> Dict[str, Any]:
        return self.to_dict()

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RoundAnalyticsResult":
        if not isinstance(data, dict):
            raise ValueError("AI analytics input must be an object")

        contract_version = data.get(
            "contractVersion",
            AI_ANALYTICS_V1_CONTRACT_VERSION,
        )
        if contract_version not in AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS:
            raise ValueError(
                "Unsupported AI analytics contract version "
                f"'{contract_version}'"
            )

        is_v3 = contract_version == AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION
        if is_v3:
            cls._validate_no_forbidden_v3_fields(data)
            total_responses = cls._required_integer(
                data,
                "totalResponses",
                minimum=0,
            )
            privacy_threshold = cls._required_integer(
                data,
                "privacyThreshold",
                minimum=10,
            )
            if not isinstance(data.get("isLocked"), bool):
                raise ValueError(
                    "AI analytics contract 3.0 requires boolean isLocked"
                )
        else:
            total_responses = int(data.get("totalResponses", 0))
            # Legacy payloads may omit the threshold. Core owns the real value
            # (default 1, configurable per round); the fallback mirrors that
            # same product default.
            privacy_threshold = int(data.get("privacyThreshold", 1))

        if privacy_threshold < 1:
            raise ValueError("privacyThreshold must be a positive integer")

        is_locked = bool(data.get("isLocked", False)) or (
            total_responses < privacy_threshold
        )
        scores_raw = data.get("dimensionScores", {})
        question_aggregates_raw = data.get("questionAggregates", {})
        if not isinstance(scores_raw, dict):
            raise ValueError("dimensionScores must be an object")
        if not isinstance(question_aggregates_raw, dict):
            raise ValueError("questionAggregates must be an object")

        if is_v3:
            round_id = cls._required_non_empty_string(data, "roundId")
            organization_id = cls._required_non_empty_string(
                data,
                "organizationId",
            )
            survey_definition_hash = cls._required_non_empty_string(
                data,
                "surveyDefinitionHash",
            )
            if not _SURVEY_DEFINITION_HASH_PATTERN.fullmatch(
                survey_definition_hash,
            ):
                raise ValueError(
                    "surveyDefinitionHash must use sha256 lowercase hex"
                )
            calculated_at = cls._required_non_empty_string(
                data,
                "calculatedAt",
            )
            if is_locked and (scores_raw or question_aggregates_raw):
                raise ValueError(
                    "Locked AI analytics contract 3.0 requires empty "
                    "dimensionScores and questionAggregates"
                )
        else:
            round_id = data.get("roundId", "")
            organization_id = None
            survey_definition_hash = None
            calculated_at = data.get("calculatedAt")

        scores = {}
        if not is_locked:
            for k, v in scores_raw.items():
                if isinstance(v, dict):
                    if is_v3:
                        cls._validate_v3_dimension_score_input(
                            k,
                            v,
                            total_responses,
                            privacy_threshold,
                        )
                    scores[k] = RoundDimensionScore.from_dict(v)
                elif isinstance(v, RoundDimensionScore):
                    if is_v3:
                        raise ValueError(
                            f"Dimension score '{k}' must be an object"
                        )
                    scores[k] = v
                elif is_v3:
                    raise ValueError(
                        f"Dimension score '{k}' must be an object"
                    )

        question_aggregates = {}
        if not is_locked:
            if is_v3:
                raw_question_ids = [
                    aggregate.get("questionId")
                    for aggregate in question_aggregates_raw.values()
                    if isinstance(aggregate, dict)
                    and isinstance(aggregate.get("questionId"), str)
                ]
                if len(raw_question_ids) != len(set(raw_question_ids)):
                    raise ValueError(
                        "AI analytics contract 3.0 requires unique "
                        "question IDs"
                    )

            for question_id, aggregate in question_aggregates_raw.items():
                if not isinstance(aggregate, dict):
                    raise ValueError(
                        f"Question aggregate '{question_id}' must be an object"
                    )
                raw_response_count = aggregate.get("responseCount", 0)
                if (
                    contract_version in {
                        AI_ANALYTICS_CONTRACT_VERSION,
                        AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
                    }
                    and (
                        not isinstance(raw_response_count, int)
                        or isinstance(raw_response_count, bool)
                    )
                ):
                    raise ValueError(
                        f"Question aggregate '{question_id}' responseCount "
                        "must be an integer"
                    )
                if is_v3:
                    cls._validate_v3_question_aggregate_input(
                        question_id,
                        aggregate,
                    )
                    question_aggregates[question_id] = {
                        "questionId": aggregate["questionId"],
                        "dimensionId": aggregate["dimensionId"],
                        "questionText": aggregate["questionText"],
                        "averageScore": float(aggregate["averageScore"]),
                        "responseCount": raw_response_count,
                    }
                else:
                    question_aggregates[question_id] = {
                        "questionId": aggregate.get(
                            "questionId",
                            question_id,
                        ),
                        "dimensionId": aggregate.get("dimensionId", ""),
                        "questionTextHebrew": aggregate.get(
                            "questionTextHebrew",
                            "",
                        ),
                        "averageScore": float(
                            aggregate.get("averageScore", 0.0),
                        ),
                        "responseCount": int(raw_response_count),
                    }

        if contract_version == AI_ANALYTICS_CONTRACT_VERSION and not is_locked:
            cls._validate_v2_aggregates(
                scores,
                question_aggregates,
                privacy_threshold,
                total_responses,
            )
        if is_v3 and not is_locked:
            cls._validate_v3_aggregates(
                scores,
                question_aggregates,
                privacy_threshold,
                total_responses,
                survey_definition_hash,
            )
        if contract_version == AI_ANALYTICS_CONTRACT_VERSION and not (
            isinstance(calculated_at, str)
            and calculated_at.strip()
        ):
            raise ValueError(
                "AI analytics contract 2.0 requires calculatedAt"
            )

        return cls(
            roundId=round_id,
            totalResponses=total_responses,
            privacyThreshold=privacy_threshold,
            isLocked=is_locked,
            dimensionScores=scores,
            organizationContext=data.get("organizationContext", {}),
            contractVersion=contract_version,
            questionAggregates=question_aggregates,
            calculatedAt=calculated_at,
            organizationId=organization_id,
            surveyDefinitionHash=survey_definition_hash,
        )

    @staticmethod
    def _required_non_empty_string(
        data: Dict[str, Any],
        field_name: str,
    ) -> str:
        value = data.get(field_name)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"AI analytics contract 3.0 requires {field_name}"
            )
        return value

    @staticmethod
    def _required_integer(
        data: Dict[str, Any],
        field_name: str,
        minimum: int,
    ) -> int:
        value = data.get(field_name)
        if (
            not isinstance(value, int)
            or isinstance(value, bool)
            or value < minimum
        ):
            raise ValueError(
                f"AI analytics contract 3.0 requires {field_name} "
                f"to be an integer of at least {minimum}"
            )
        return value

    @classmethod
    def _validate_no_forbidden_v3_fields(cls, data: Any) -> None:
        if isinstance(data, dict):
            forbidden = _V3_FORBIDDEN_FIELDS.intersection(data)
            if forbidden:
                raise ValueError(
                    "AI analytics contract 3.0 forbids respondent-level "
                    f"field '{sorted(forbidden)[0]}'"
                )
            for value in data.values():
                cls._validate_no_forbidden_v3_fields(value)
        elif isinstance(data, list):
            for value in data:
                cls._validate_no_forbidden_v3_fields(value)

    @staticmethod
    def _validate_v3_dimension_score_input(
        map_key: str,
        score: Dict[str, Any],
        total_responses: int,
        privacy_threshold: int,
    ) -> None:
        average_score = score.get("averageScore")
        if (
            not isinstance(average_score, (int, float))
            or isinstance(average_score, bool)
            or not math.isfinite(float(average_score))
        ):
            raise ValueError(
                f"Dimension score '{map_key}' averageScore must be numeric"
            )

        for count_field in ("responseCount", "totalResponses"):
            if count_field not in score:
                continue
            count = score[count_field]
            if (
                not isinstance(count, int)
                or isinstance(count, bool)
                or count < privacy_threshold
                or count > total_responses
            ):
                raise ValueError(
                    f"Dimension score '{map_key}' {count_field} is outside "
                    "the privacy-safe round"
                )

        if "isLocked" in score and score["isLocked"] is not False:
            raise ValueError(
                f"Dimension score '{map_key}' cannot be locked in an "
                "unlocked round"
            )

    @staticmethod
    def _validate_v3_question_aggregate_input(
        map_key: str,
        aggregate: Dict[str, Any],
    ) -> None:
        for field_name in ("questionId", "dimensionId", "questionText"):
            value = aggregate.get(field_name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(
                    f"Question aggregate '{map_key}' requires {field_name}"
                )

        question_text = aggregate["questionText"]
        if (
            not _HEBREW_PATTERN.search(question_text)
            or _LATIN_PATTERN.search(question_text)
        ):
            raise ValueError(
                f"Question aggregate '{map_key}' questionText must be "
                "Hebrew-only user-facing text"
            )

        average_score = aggregate.get("averageScore")
        if (
            not isinstance(average_score, (int, float))
            or isinstance(average_score, bool)
            or not math.isfinite(float(average_score))
        ):
            raise ValueError(
                f"Question aggregate '{map_key}' averageScore must be numeric"
            )

    @staticmethod
    def _validate_v3_aggregates(
        scores: Dict[str, RoundDimensionScore],
        question_aggregates: Dict[str, Dict[str, Any]],
        privacy_threshold: int,
        total_responses: int,
        survey_definition_hash: str,
    ) -> None:
        expected_dimensions = set(AI_ANALYTICS_DIMENSION_IDS)
        if set(scores) != expected_dimensions:
            raise ValueError(
                "AI analytics contract 3.0 requires exactly eight "
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
            if score.computedStatus != status_for_score(score.averageScore):
                raise ValueError(
                    f"Dimension status '{dimension_id}' is inconsistent "
                    "with its score"
                )

        question_ids = [
            aggregate["questionId"]
            for aggregate in question_aggregates.values()
        ]
        if len(question_ids) != len(set(question_ids)):
            raise ValueError(
                "AI analytics contract 3.0 requires unique question IDs"
            )

        covered_dimensions = set()
        for map_key, aggregate in question_aggregates.items():
            if aggregate["questionId"] != map_key:
                raise ValueError(
                    f"Question aggregate '{map_key}' has a key mismatch"
                )
            dimension_id = aggregate["dimensionId"]
            if dimension_id not in expected_dimensions:
                raise ValueError(
                    f"Question aggregate '{map_key}' must use a supported "
                    "dimension"
                )
            covered_dimensions.add(dimension_id)
            if not 0 <= aggregate["averageScore"] <= 100:
                raise ValueError(
                    f"Question aggregate '{map_key}' is outside 0..100"
                )
            if aggregate["responseCount"] < privacy_threshold:
                raise ValueError(
                    f"Question aggregate '{map_key}' responseCount is "
                    "below privacyThreshold"
                )
            if aggregate["responseCount"] > total_responses:
                raise ValueError(
                    f"Question aggregate '{map_key}' responseCount "
                    "exceeds totalResponses"
                )

        if covered_dimensions != expected_dimensions:
            raise ValueError(
                "AI analytics contract 3.0 questions must cover all eight "
                "canonical dimensions"
            )

        projection = [
            {
                "questionId": aggregate["questionId"],
                "dimensionId": aggregate["dimensionId"],
                "questionText": aggregate["questionText"],
            }
            for aggregate in sorted(
                question_aggregates.values(),
                key=lambda item: item["questionId"],
            )
        ]
        serialized = json.dumps(
            projection,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        computed_hash = f"sha256:{hashlib.sha256(serialized).hexdigest()}"
        if survey_definition_hash != computed_hash:
            raise ValueError(
                "surveyDefinitionHash does not match dynamic question "
                "aggregates"
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
    questionId: Optional[str] = None
    averageScore: Optional[float] = None
    responseCount: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        return {
            key: value
            for key, value in result.items()
            if value is not None
        }

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
    generationProvenance: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "dimensionId": self.dimensionId,
            "dimensionNameHebrew": self.dimensionNameHebrew,
            "status": self.status,
            "score": self.score,
            "psychologicalInterpretation": self.psychologicalInterpretation,
            "recommendedInterventions": [i.to_dict() if hasattr(i, "to_dict") else i for i in self.recommendedInterventions],
            "metrics": [m.to_dict() if hasattr(m, "to_dict") else m for m in self.metrics]
        }
        if self.generationProvenance is not None:
            result["generationProvenance"] = dict(
                self.generationProvenance,
            )
        return result

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
    surveyDefinitionHash: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "contractVersion": self.contractVersion,
            "roundId": self.roundId,
            "processedAt": self.processedAt,
            "isLocked": self.isLocked,
            "status": self.status,
            "errorMessage": self.errorMessage,
            "overallPsychologicalSummary": self.overallPsychologicalSummary,
            "stones": {k: v.to_dict() if hasattr(v, "to_dict") else v for k, v in self.stones.items()}
        }
        if self.surveyDefinitionHash is not None:
            result["surveyDefinitionHash"] = self.surveyDefinitionHash
        return result
