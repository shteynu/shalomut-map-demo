"""Drafting one more questionnaire item, which is not a round.

The builder's library is three hardcoded items covering three dimensions of
eight, so a manager cannot write a round about the other five without composing
every line themselves. This endpoint asks the model for a draft. It is the one
call in this service with no round behind it: no MCP read, no aggregates, no
respondent data, and nothing persisted.

What the tests hold: the shape of an acceptable item, the refusal of everything
that cannot be one, that a refusal never becomes copy this service wrote, and
that the endpoint is closed to an unauthenticated caller.
"""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.config import settings
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_QUESTIONS,
)
from src.main import app
from src.services import hebrew_prompts, hebrew_validation
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)

client = TestClient(app)

SUGGESTED_ITEM = "אני מרגישה שיש לי מסגרת ברורה לתכנון השבוע הקרוב."


class FakeResponse:
    """The provider's HTTP answer, as `urllib` hands it over."""

    status = 200

    def __init__(self, content):
        self._content = content

    def read(self):
        return json.dumps(
            {
                "choices": [
                    {
                        "message": {"content": self._content},
                        "finish_reason": "stop",
                    },
                ],
            },
        ).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def _answering_provider(monkeypatch, *answers):
    """A provider that returns each answer in turn, and records the prompts."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-suggestion")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", len(answers) or 1)
    prompts = []
    remaining = list(answers)

    def fake_urlopen(request, timeout=None):
        payload = json.loads(request.data.decode("utf-8"))
        prompts.append(payload["messages"][-1]["content"])
        return FakeResponse(remaining.pop(0) if remaining else "")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    return prompts


def test_the_prompt_carries_the_instrument_and_the_draft(monkeypatch):
    """A suggestion has to sound like the questionnaire it is joining.

    The canonical items of the dimension are the style, and the manager's own
    lines are there so the model does not hand back one of them.
    """
    prompts = _answering_provider(monkeypatch, SUGGESTED_ITEM)
    existing = "אני יודעת מה מצפים ממני בשבוע הקרוב."

    suggestion = llm_provider_service.suggest_question_result(
        dimension_id="certainty",
        dimension_hebrew="ודאות",
        existing_texts=[existing],
    )

    assert suggestion.text == SUGGESTED_ITEM
    assert suggestion.attempts == 1
    prompt = prompts[0]
    for canonical in hebrew_prompts.canonical_statements_for_dimension(
        "certainty",
    ):
        assert canonical in prompt
    assert existing in prompt
    # No round travels with a suggestion, so nothing about scores or a school
    # may appear in the prompt at all.
    assert "ציון" not in prompt
    assert "רקע בית הספר" not in prompt


@pytest.mark.parametrize(
    "refused, reason",
    [
        ("This is an English item about my week.", "not Hebrew"),
        ("האם את מרגישה שיש לך מסגרת ברורה לשבוע?", "a question, not a statement"),
        ("אני מרגישה שיש לי 3 שעות תכנון בשבוע.", "carries a number"),
        ("אני מרגישה שיש לי מסגרת ברורה", "no sentence end"),
        ("אני עייפה.", "too short to be an item"),
        (
            "אני מרגישה שיש לי מסגרת ברורה לתכנון השבוע. "
            "אני גם מרגישה שיש לי זמן להתכונן.",
            "two sentences",
        ),
    ],
)
def test_an_answer_that_cannot_be_an_item_is_refused(refused, reason):
    assert not hebrew_validation.is_valid_question_suggestion(refused), reason


def test_an_item_the_questionnaire_already_holds_is_refused():
    """Suggesting a line back to the manager who wrote it is not a suggestion.

    Compared on the normalised text, so a trailing period or a doubled space
    does not make the same sentence look new.
    """
    existing = AI_ANALYTICS_QUESTIONS[0]["textHebrew"]

    assert not hebrew_validation.is_valid_question_suggestion(
        existing,
        [existing],
    )
    assert not hebrew_validation.is_valid_question_suggestion(
        f"  {existing.rstrip('.')}  ",
        [existing],
    )
    assert hebrew_validation.is_valid_question_suggestion(
        SUGGESTED_ITEM,
        [existing],
    )


def test_every_canonical_item_passes_the_check():
    """The instrument's own twenty-four are the definition of a valid item.

    A tightening that refuses them would be refusing the questionnaire this
    product ships with.
    """
    for question in AI_ANALYTICS_QUESTIONS:
        assert hebrew_validation.is_valid_question_suggestion(
            question["textHebrew"],
        ), question["id"]


def test_a_refused_answer_is_retried_and_then_raises(monkeypatch):
    """A refusal never turns into a sentence this service wrote itself.

    Core holds a template library for the case where the model cannot answer,
    and labels it as the template. Copy invented here and returned as a
    suggestion would be the fallback wearing the model's label.
    """
    _answering_provider(
        monkeypatch,
        "Not Hebrew at all.",
        "אני מרגישה שיש לי 5 שעות.",
    )

    with pytest.raises(ProviderUnavailableError) as raised:
        llm_provider_service.suggest_question_result(
            dimension_id="certainty",
            dimension_hebrew="ודאות",
        )

    assert raised.value.reason == "invalid_semantic_output"
    assert raised.value.dimension_id == "certainty"


def test_the_endpoint_answers_a_suggestion(monkeypatch):
    monkeypatch.setattr(settings, "env", "development")
    monkeypatch.setattr(settings, "ai_webhook_secret", "")

    with patch.object(
        llm_provider_service,
        "suggest_question_result",
        return_value=type("S", (), {"text": SUGGESTED_ITEM, "attempts": 1})(),
    ):
        response = client.post(
            "/api/v1/questions/suggest",
            json={"dimensionId": "certainty", "existingTexts": ["אני יודעת."]},
        )

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "dimensionId": "certainty",
        "dimensionNameHebrew": "ודאות",
        "questionText": SUGGESTED_ITEM,
        "attempts": 1,
        "source": "llm",
    }


def test_the_endpoint_refuses_an_unauthenticated_caller(monkeypatch):
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "ai_webhook_secret", "webhook-secret")

    response = client.post(
        "/api/v1/questions/suggest",
        json={"dimensionId": "certainty"},
    )
    assert response.status_code == 401

    response = client.post(
        "/api/v1/questions/suggest",
        json={"dimensionId": "certainty"},
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert response.status_code == 401


def test_the_endpoint_requires_its_secret_outside_development(monkeypatch):
    """Fail closed rather than open: no secret configured is a 503, not a pass."""
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "ai_webhook_secret", "")

    response = client.post(
        "/api/v1/questions/suggest",
        json={"dimensionId": "certainty"},
    )

    assert response.status_code == 503


def test_the_endpoint_refuses_a_dimension_outside_the_eight(monkeypatch):
    """The eight dimensions are the taxonomy; an item belongs to one of them."""
    monkeypatch.setattr(settings, "env", "development")
    monkeypatch.setattr(settings, "ai_webhook_secret", "")

    response = client.post(
        "/api/v1/questions/suggest",
        json={"dimensionId": "not-a-dimension"},
    )

    assert response.status_code == 400
    assert "not-a-dimension" not in response.text
    assert len(AI_ANALYTICS_DIMENSION_IDS) == 8


def test_the_endpoint_reports_an_unavailable_provider(monkeypatch):
    monkeypatch.setattr(settings, "env", "development")
    monkeypatch.setattr(settings, "ai_webhook_secret", "")

    with patch.object(
        llm_provider_service,
        "suggest_question_result",
        side_effect=ProviderUnavailableError(
            "http_429",
            dimension_id="certainty",
        ),
    ):
        response = client.post(
            "/api/v1/questions/suggest",
            json={"dimensionId": "certainty"},
        )

    assert response.status_code == 503
    assert "http_429" in response.json()["detail"]


def test_a_long_draft_does_not_grow_the_prompt_without_limit(monkeypatch):
    """The manager's draft is bounded before it becomes prompt text."""
    from src.schemas.question_suggestion import (
        MAX_EXISTING_TEXTS,
        QuestionSuggestionRequest,
    )

    request = QuestionSuggestionRequest(
        dimensionId="certainty",
        existingTexts=["אני יודעת מה מצפים ממני." for _ in range(200)]
        + ["", "   "],
    )

    bounded = request.bounded_existing_texts()
    assert len(bounded) == MAX_EXISTING_TEXTS
    assert all(text.strip() for text in bounded)
