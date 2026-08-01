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
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
    AI_ANALYTICS_QUESTION_IDS,
    AI_ANALYTICS_QUESTIONS_BY_ID,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_V1_CONTRACT_VERSION,
    AI_ANALYTICS_V4_CONTRACT_VERSION,
    AI_ANALYTICS_V5_CONTRACT_VERSION,
)
from src.schemas.contract_registry import get_capabilities

DimensionStatus = Literal["green", "yellow", "red"]

# Respondents a round needs before anything below the round total may be read.
# Core owns the number; this mirror exists so a payload from an older Core, or
# from a round configured before the requirement, cannot buy a lower one.
MINIMUM_PRIVACY_THRESHOLD = 10

_SURVEY_DEFINITION_HASH_PATTERN = re.compile(r"^sha256:[a-f0-9]{64}$")
# The _BACKGROUND_CONTEXT_CONTRACT_VERSIONS set has been moved to capabilities.json
_HEBREW_PATTERN = re.compile(r"[\u0590-\u05ff]")
_LATIN_PATTERN = re.compile(r"[A-Za-z]")
_DYNAMIC_FORBIDDEN_FIELDS = frozenset(
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
    privacyThreshold: int = MINIMUM_PRIVACY_THRESHOLD
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

        if not isinstance(data.get("isLocked"), bool):
            raise ValueError(
                "AI analytics contract requires boolean isLocked"
            )

        is_dynamic = get_capabilities(contract_version).supportsDynamicQuestions
        if is_dynamic:
            cls._validate_no_forbidden_dynamic_fields(data)
            total_responses = cls._required_integer(
                data,
                "totalResponses",
                minimum=0,
            )
            privacy_threshold = cls._required_integer(
                data,
                "privacyThreshold",
                minimum=1,
            )
        else:
            total_responses = int(data.get("totalResponses", 0))
            # Legacy payloads may omit the threshold. Core owns the real
            # value; the fallback mirrors the same product requirement.
            privacy_threshold = int(
                data.get("privacyThreshold", MINIMUM_PRIVACY_THRESHOLD),
            )

        if privacy_threshold < 1:
            raise ValueError("privacyThreshold must be a positive integer")

        # What the round was configured with, kept for judging the payload
        # against its own claim, and what the product now requires. A round
        # configured below the requirement is raised to it rather than refused:
        # refusing would drop the round, raising it makes the round read as
        # locked, which is what too few answers mean.
        declared_threshold = privacy_threshold
        privacy_threshold = max(declared_threshold, MINIMUM_PRIVACY_THRESHOLD)

        scores_raw = data.get("dimensionScores", {})
        question_aggregates_raw = data.get("questionAggregates", {})
        if not isinstance(scores_raw, dict):
            raise ValueError("dimensionScores must be an object")
        if not isinstance(question_aggregates_raw, dict):
            raise ValueError("questionAggregates must be an object")

        declared_lock = bool(data.get("isLocked", False)) or (
            total_responses < declared_threshold
        )
        question_counts = [
            aggregate["responseCount"]
            for aggregate in question_aggregates_raw.values()
            if isinstance(aggregate, dict)
            and isinstance(aggregate.get("responseCount"), int)
            and not isinstance(aggregate.get("responseCount"), bool)
        ]
        # An aggregate below the round's own threshold is a producer fault and
        # still raises further down. This is the other case: a round that kept
        # its own promise and is short only of the product requirement. A
        # single question answered by fewer than ten locks it as surely as a
        # small total, because the reading would describe those respondents
        # rather than the school.
        keeps_its_own_promise = all(
            count >= declared_threshold for count in question_counts
        )
        below_requirement = keeps_its_own_promise and (
            total_responses < privacy_threshold
            or any(count < privacy_threshold for count in question_counts)
        )
        is_locked = declared_lock or below_requirement

        if is_dynamic:
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
            # Judged against the round's own claim: a producer that says
            # "locked" and still sends detail is the leak this catches. A round
            # locked only by this service's floor sent its detail in good faith
            # and simply does not get read.
            if declared_lock and (scores_raw or question_aggregates_raw):
                raise ValueError(
                    "Dynamic AI analytics contract requires empty "
                    "dimensionScores and questionAggregates on a locked round"
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
                    if is_dynamic:
                        cls._validate_dynamic_dimension_score_input(
                            k,
                            v,
                            total_responses,
                            declared_threshold,
                        )
                    scores[k] = RoundDimensionScore.from_dict(v)
                elif isinstance(v, RoundDimensionScore):
                    if is_dynamic:
                        raise ValueError(
                            f"Dimension score '{k}' must be an object"
                        )
                    scores[k] = v
                elif is_dynamic:
                    raise ValueError(
                        f"Dimension score '{k}' must be an object"
                    )

        question_aggregates = {}
        if not is_locked:
            if is_dynamic:
                raw_question_ids = [
                    aggregate.get("questionId")
                    for aggregate in question_aggregates_raw.values()
                    if isinstance(aggregate, dict)
                    and isinstance(aggregate.get("questionId"), str)
                ]
                if len(raw_question_ids) != len(set(raw_question_ids)):
                    raise ValueError(
                        "Dynamic AI analytics contract requires unique "
                        "question IDs"
                    )

            for question_id, aggregate in question_aggregates_raw.items():
                if not isinstance(aggregate, dict):
                    raise ValueError(
                        f"Question aggregate '{question_id}' must be an object"
                    )
                raw_response_count = aggregate.get("responseCount", 0)
                if (
                    get_capabilities(contract_version).isSemanticContract
                    and (
                        not isinstance(raw_response_count, int)
                        or isinstance(raw_response_count, bool)
                    )
                ):
                    raise ValueError(
                        f"Question aggregate '{question_id}' responseCount "
                        "must be an integer"
                    )
                if is_dynamic:
                    cls._validate_dynamic_question_aggregate_input(
                        question_id,
                        aggregate,
                        contract_version=contract_version,
                    )
                    q_item = {
                        "questionId": aggregate["questionId"],
                        "dimensionId": aggregate["dimensionId"],
                        "questionText": aggregate["questionText"],
                        "averageScore": float(aggregate["averageScore"]),
                        "responseCount": raw_response_count,
                    }
                    if get_capabilities(contract_version).supportsScoreDistribution and "scoreDistribution" in aggregate:
                        q_item["scoreDistribution"] = {
                            "green": int(aggregate["scoreDistribution"]["green"]),
                            "yellow": int(aggregate["scoreDistribution"]["yellow"]),
                            "red": int(aggregate["scoreDistribution"]["red"]),
                        }
                    question_aggregates[question_id] = q_item
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

        if not is_dynamic and get_capabilities(contract_version).isSemanticContract and not is_locked:
            cls._validate_v2_aggregates(
                scores,
                question_aggregates,
                declared_threshold,
                total_responses,
            )
        if is_dynamic and not is_locked:
            cls._validate_dynamic_aggregates(
                scores,
                question_aggregates,
                declared_threshold,
                total_responses,
                survey_definition_hash,
            )
        if not is_dynamic and get_capabilities(contract_version).isSemanticContract and not (
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
            # Contracts 4.0 and 5.0 carry the school background context; it has
            # to survive parsing, otherwise the prompt never sees it. 5.0 is
            # 4.0 plus score distributions and Core sends the context on both
            # (`src/app/api/mcp/route.ts`), so matching 4.0 exactly made the
            # upgrade trade the context away instead of adding to it. Versions
            # 1.0-3.0 are immutable and gain no context here.
            backgroundContext=(
                data.get("backgroundContext")
                if get_capabilities(contract_version).supportsBackgroundContext
                and isinstance(data.get("backgroundContext"), dict)
                else {}
            ),
        )

    @staticmethod
    def _required_non_empty_string(
        data: Dict[str, Any],
        field_name: str,
    ) -> str:
        value = data.get(field_name)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"Dynamic AI analytics contract requires {field_name}"
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
                f"Dynamic AI analytics contract requires {field_name} "
                f"to be an integer of at least {minimum}"
            )
        return value

    @classmethod
    def _validate_no_forbidden_dynamic_fields(cls, data: Any) -> None:
        if isinstance(data, dict):
            forbidden = _DYNAMIC_FORBIDDEN_FIELDS.intersection(data)
            if forbidden:
                raise ValueError(
                    "Dynamic AI analytics contract forbids respondent-level "
                    f"field '{sorted(forbidden)[0]}'"
                )
            for value in data.values():
                cls._validate_no_forbidden_dynamic_fields(value)
        elif isinstance(data, list):
            for value in data:
                cls._validate_no_forbidden_dynamic_fields(value)

    @staticmethod
    def _validate_dynamic_dimension_score_input(
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
    def _validate_dynamic_question_aggregate_input(
        map_key: str,
        aggregate: Dict[str, Any],
        contract_version: str = AI_ANALYTICS_V4_CONTRACT_VERSION,
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

        if get_capabilities(contract_version).supportsScoreDistribution:
            score_dist = aggregate.get("scoreDistribution")
            if not isinstance(score_dist, dict):
                raise ValueError(
                    f"Question aggregate '{map_key}' in 5.0 requires scoreDistribution object"
                )
            for k in ("green", "yellow", "red"):
                val = score_dist.get(k)
                if not isinstance(val, int) or isinstance(val, bool) or val < 0:
                    raise ValueError(
                        f"Question aggregate '{map_key}' scoreDistribution.{k} must be non-negative integer"
                    )
            raw_response_count = aggregate.get("responseCount", 0)
            if score_dist["green"] + score_dist["yellow"] + score_dist["red"] != raw_response_count:
                raise ValueError(
                    f"Question aggregate '{map_key}' scoreDistribution sum must equal responseCount"
                )

    @staticmethod
    def _validate_dynamic_aggregates(
        scores: Dict[str, RoundDimensionScore],
        question_aggregates: Dict[str, Dict[str, Any]],
        privacy_threshold: int,
        total_responses: int,
        survey_definition_hash: str,
    ) -> None:
        expected_dimensions = set(AI_ANALYTICS_DIMENSION_IDS)
        if set(scores) != expected_dimensions:
            raise ValueError(
                "Dynamic AI analytics contract requires exactly eight "
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
                "Dynamic AI analytics contract requires unique question IDs"
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
                "Dynamic AI analytics contract questions must cover all eight "
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
