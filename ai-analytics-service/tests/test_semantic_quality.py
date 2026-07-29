import json
import re

import pytest

from src.agents.graph import format_stone_map_output_node
from src.agents.nodes import (
    agent_psychologist_node,
    agent_safety_validator_node,
)
from src.config import settings
from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_QUESTIONS,
    AI_ANALYTICS_V1_CONTRACT_VERSION,
)
from src.schemas.mcp_types import RoundAnalyticsResult
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)


BALANCE_QUESTIONS = {
    "balance-1": {
        "questionId": "balance-1",
        "dimensionId": "balance",
        "questionTextHebrew": "אני מצליחה לבצע את משימות העבודה בזמן שנקבע.",
        "averageScore": 80.0,
        "responseCount": 12,
    },
    "balance-2": {
        "questionId": "balance-2",
        "dimensionId": "balance",
        "questionTextHebrew": "יש לי מספיק זמן למנוחה ולהתאוששות אחרי העבודה.",
        "averageScore": 20.0,
        "responseCount": 12,
    },
    "balance-3": {
        "questionId": "balance-3",
        "dimensionId": "balance",
        "questionTextHebrew": "אני מרגישה שהעומס בעבודה מתאים לי והוא בהישג יד/בר־ביצוע עבורי.",
        "averageScore": 40.0,
        "responseCount": 12,
    },
}


class FakeLLMResponse:
    def __init__(self, content: str, finish_reason: str | None):
        self.status = 200
        self._body = json.dumps(
            {
                "choices": [
                    {
                        "finish_reason": finish_reason,
                        "message": {"content": content},
                    },
                ],
            },
        ).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return self._body


def configure_provider(monkeypatch, response: FakeLLMResponse):
    monkeypatch.setattr(settings, "llm_api_key", "semantic-test-key")
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "llm_key_provider", "openai", raising=False)
    monkeypatch.setattr(settings, "llm_base_url", "")
    monkeypatch.setattr(settings, "llm_model_fast", "semantic-test-model")
    monkeypatch.setattr(settings, "max_tokens_per_dimension", 180)
    monkeypatch.setattr(settings, "only_llm_for_problematic", True)
    monkeypatch.setattr(settings, "llm_max_attempts", 1, raising=False)
    monkeypatch.setattr(
        settings,
        "llm_request_timeout_seconds",
        20.0,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "llm_retry_budget_seconds",
        25.0,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "llm_min_retry_window_seconds",
        8.0,
        raising=False,
    )
    monkeypatch.setattr("urllib.request.urlopen", lambda *_args, **_kwargs: response)


def test_unlocked_model_requires_explicit_question_aggregates():
    normalized = RoundAnalyticsResult.from_dict(
        {
            "roundId": "round-semantic",
            "totalResponses": 12,
            "privacyThreshold": 10,
            "isLocked": False,
            "dimensionScores": {
                "balance": {
                    "dimensionId": "balance",
                    "averageScore": 46.7,
                    "computedStatus": "red",
                },
            },
            "questionAggregates": BALANCE_QUESTIONS,
        },
    ).to_dict()

    assert normalized.get("questionAggregates") == BALANCE_QUESTIONS
    assert normalized["contractVersion"] == AI_ANALYTICS_V1_CONTRACT_VERSION


def test_explicit_legacy_input_preserves_legacy_effective_version():
    normalized = RoundAnalyticsResult.from_dict(
        {
            "contractVersion": AI_ANALYTICS_V1_CONTRACT_VERSION,
            "roundId": "round-legacy",
            "totalResponses": 12,
            "privacyThreshold": 10,
            "isLocked": False,
            "dimensionScores": {},
        },
    ).to_dict()

    assert normalized["contractVersion"] == AI_ANALYTICS_V1_CONTRACT_VERSION


def test_explicit_v2_requires_the_complete_canonical_aggregate_set():
    with pytest.raises(ValueError, match="exactly eight"):
        RoundAnalyticsResult.from_dict(
            {
                "contractVersion": AI_ANALYTICS_CONTRACT_VERSION,
                "roundId": "round-incomplete-v2",
                "totalResponses": 12,
                "privacyThreshold": 10,
                "isLocked": False,
                "dimensionScores": {},
                "questionAggregates": {},
            },
        )


def test_locked_model_requires_empty_aggregate_maps():
    normalized = RoundAnalyticsResult.from_dict(
        {
            "roundId": "round-semantic-locked",
            "totalResponses": 9,
            "privacyThreshold": 10,
            "isLocked": True,
            "dimensionScores": {
                "balance": {
                    "dimensionId": "balance",
                    "averageScore": 0,
                    "computedStatus": "yellow",
                },
            },
            "questionAggregates": BALANCE_QUESTIONS,
        },
    ).to_dict()

    assert normalized.get("dimensionScores") == {}
    assert normalized.get("questionAggregates") == {}


@pytest.mark.parametrize("finish_reason", [None, "length", "content_filter"])
def test_provider_rejects_a_non_stop_finish_reason(monkeypatch, finish_reason):
    provider_text = (
        "הנתונים מצביעים על קושי מתמשך באיזון. "
        "נדרש מעקב אחר השינויים במדדי השאלות."
    )
    configure_provider(
        monkeypatch,
        FakeLLMResponse(provider_text, finish_reason),
    )

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation(
            "balance",
            "איזון",
            46.7,
            "red",
        )

    assert failure.value.reason == "invalid_finish_reason"


@pytest.mark.parametrize(
    "invalid_text",
    [
        "Staff wellbeing requires immediate attention. Workload remains high.",
        "הנתונים מצביעים על קושי מתמשך ללא משפט שני",
        "משפט עברי ראשון. משפט עברי שני. משפט עברי שלישי.",
        "הנתונים לפי OECD דורשים תשומת לב. המעקב יימשך באופן מצרפי.",
    ],
)
def test_provider_rejects_non_hebrew_or_incomplete_copy(monkeypatch, invalid_text):
    configure_provider(monkeypatch, FakeLLMResponse(invalid_text, "stop"))

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation(
            "balance",
            "איזון",
            46.7,
            "red",
        )

    assert failure.value.reason == "invalid_semantic_output"


def test_provider_accepts_complete_hebrew_copy_with_stop(monkeypatch):
    provider_text = (
        "ממוצעי השאלות מצביעים על קושי באיזון בין העומס לזמן. "
        "הפער בין זמן הביצוע לזמן ההתאוששות דורש תשומת לב."
    )
    configure_provider(monkeypatch, FakeLLMResponse(provider_text, "stop"))

    result = llm_provider_service.generate_psychological_interpretation(
        "balance",
        "איזון",
        46.7,
        "red",
    )

    assert result == provider_text


def test_provider_rejects_copy_that_contradicts_the_input_status(monkeypatch):
    provider_text = (
        "המדד נמצא באזור ירוק ומציג חוזקה יציבה. "
        "הנתונים המצרפיים אינם דורשים תשומת לב."
    )
    configure_provider(monkeypatch, FakeLLMResponse(provider_text, "stop"))

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation(
            "balance",
            "איזון",
            46.7,
            "red",
        )

    assert failure.value.reason == "invalid_semantic_output"


def build_balance_state(average_score: float, status: str):
    return {
        "round_data": {
            "roundId": "round-grounded-copy",
            "dimensionScores": {
                "balance": {
                    "dimensionId": "balance",
                    "averageScore": average_score,
                    "computedStatus": status,
                },
            },
            "questionAggregates": BALANCE_QUESTIONS,
        },
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }


@pytest.mark.asyncio
async def test_the_green_dimension_written_here_quotes_its_strongest_question(
    monkeypatch,
):
    """The one interpretation this service still writes itself.

    A green dimension is deliberately never sent to the provider, so there is
    no failed call being covered up — and the sentence still has to come from
    the round's own aggregates.
    """
    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "only_llm_for_problematic", True)

    result = await agent_psychologist_node(build_balance_state(80.0, "green"))
    interpretation = result["interpretations"][
        "dimension_interpretations"
    ]["balance"]
    strongest_question = BALANCE_QUESTIONS["balance-1"]

    assert result["safety_status"] != "provider_unavailable"
    assert strongest_question["questionTextHebrew"] in interpretation
    assert str(int(strongest_question["averageScore"])) in interpretation


@pytest.mark.asyncio
async def test_a_dimension_the_provider_never_answered_stops_the_round(
    monkeypatch,
):
    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "only_llm_for_problematic", True)

    result = await agent_psychologist_node(build_balance_state(46.7, "red"))

    assert result["safety_status"] == "provider_unavailable"
    assert result["provider_failure_reason"] == "missing_api_key"
    assert result.get("interpretations") == {}


def test_safety_validator_never_passes_a_status_contradiction_at_retry_limit():
    state = {
        "round_data": {
            "dimensionScores": {
                "meaning": {
                    "dimensionId": "meaning",
                    "averageScore": 90,
                    "computedStatus": "green",
                },
            },
        },
        "org_context": {},
        "interpretations": {
            "dimension_interpretations": {
                "meaning": "המדד נמצא באזור אדום ודורש טיפול מיידי.",
            },
        },
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 3,
        "final_payload": {},
    }

    result = agent_safety_validator_node(state)

    assert result["safety_status"] != "pass"


def test_formatter_emits_real_question_metrics_instead_of_the_generic_template():
    state = {
        "round_data": {
            "roundId": "round-semantic",
            "dimensionScores": {
                "balance": {
                    "dimensionId": "balance",
                    "averageScore": 46.7,
                    "computedStatus": "red",
                },
            },
            "questionAggregates": BALANCE_QUESTIONS,
        },
        "org_context": {},
        "interpretations": {
            "overall_summary": "סיכום כללי מאומת.",
            "dimension_interpretations": {
                "balance": "נמצא פער בין מדדי האיזון. הפער דורש תשומת לב.",
            },
        },
        "recommendations": {"balance": []},
        "safety_status": "pass",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }

    result = format_stone_map_output_node(state)
    metrics = result["final_payload"]["stones"]["balance"]["metrics"]

    assert [metric.get("questionId") for metric in metrics] == list(
        BALANCE_QUESTIONS,
    )
    assert [metric.get("label") for metric in metrics] == [
        question["questionTextHebrew"]
        for question in BALANCE_QUESTIONS.values()
    ]
    assert not {"ציון ממוצע", "סטטוס מחוון", "רמת סיכון"}.intersection(
        metric.get("label") for metric in metrics
    )


def test_v2_input_rejects_status_inconsistent_with_score():
    scores = {
        dimension_id: {
            "dimensionId": dimension_id,
            "averageScore": 60,
            "computedStatus": "yellow",
        }
        for dimension_id in AI_ANALYTICS_DIMENSION_IDS
    }
    scores["balance"]["computedStatus"] = "green"
    question_aggregates = {
        question["id"]: {
            "questionId": question["id"],
            "dimensionId": question["dimensionId"],
            "questionTextHebrew": question["textHebrew"],
            "averageScore": 60,
            "responseCount": 12,
        }
        for question in AI_ANALYTICS_QUESTIONS
    }

    with pytest.raises(ValueError, match="inconsistent with its score"):
        RoundAnalyticsResult.from_dict(
            {
                "contractVersion": AI_ANALYTICS_CONTRACT_VERSION,
                "roundId": "round-status-mismatch",
                "totalResponses": 12,
                "privacyThreshold": 10,
                "isLocked": False,
                "dimensionScores": scores,
                "questionAggregates": question_aggregates,
            },
        )


@pytest.mark.parametrize(
    ("response_count", "expected_error"),
    [
        (9, "below privacyThreshold"),
        (13, "exceeds totalResponses"),
    ],
)
def test_v2_input_rejects_question_counts_outside_the_privacy_safe_round(
    response_count,
    expected_error,
):
    dimension_scores = {
        dimension_id: {
            "dimensionId": dimension_id,
            "averageScore": 60,
            "computedStatus": "yellow",
        }
        for dimension_id in AI_ANALYTICS_DIMENSION_IDS
    }
    question_aggregates = {
        question["id"]: {
            "questionId": question["id"],
            "dimensionId": question["dimensionId"],
            "questionTextHebrew": question["textHebrew"],
            "averageScore": 60,
            "responseCount": response_count,
        }
        for question in AI_ANALYTICS_QUESTIONS
    }

    with pytest.raises(ValueError, match=expected_error):
        RoundAnalyticsResult.from_dict(
            {
                "contractVersion": AI_ANALYTICS_CONTRACT_VERSION,
                "roundId": "round-question-count-boundary",
                "totalResponses": 12,
                "privacyThreshold": 10,
                "isLocked": False,
                "dimensionScores": dimension_scores,
                "questionAggregates": question_aggregates,
                "calculatedAt": "2026-07-25T12:00:00Z",
            },
        )
