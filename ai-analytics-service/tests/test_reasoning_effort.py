"""What the model may spend on thinking, and who gets to say so.

Thinking tokens are billed at the output rate and are the larger half of every
bill this service has produced — 1440 against 108 visible ones in the
interpretation measured on 2026-07-28. Until `LLM_REASONING_EFFORT` existed the
request said nothing about them, so the size of that half was the provider's
default and nobody's decision.

These tests hold the three properties that make the knob safe to leave in place:
that an unset variable sends the request this service always sent, that a set
one reaches the provider verbatim, and that a misspelt one costs the old
behaviour rather than a `400` on every call of the round.
"""

import json

import pytest

from src.config import SUPPORTED_REASONING_EFFORTS, Settings, settings
from src.services.llm_transport import complete_with_retries


class _Response:
    status = 200

    def __init__(self, text: str):
        self._text = text

    def read(self):
        return json.dumps(
            {
                "choices": [
                    {
                        "message": {"content": self._text},
                        "finish_reason": "stop",
                    },
                ],
            },
        ).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


ANSWER = "אני מרגישה שיש לי מסגרת ברורה לתכנון השבוע הקרוב."


def _sent_body(monkeypatch) -> dict:
    """Drive one accepted call and return the JSON it put on the wire."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-effort")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)

    captured = {}

    def fake_urlopen(request, *_args, **_kwargs):
        captured["body"] = json.loads(request.data.decode("utf-8"))
        return _Response(ANSWER)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    text, _attempts, reason = complete_with_retries(
        build_prompt=lambda critique=None: "prompt",
        system_prompt="system",
        model_name="gemini-3.5-flash",
        is_acceptable=lambda text, finish_reason: bool(text),
    )

    assert text and reason == ""
    return captured["body"]


def test_an_unset_effort_sends_the_request_this_service_always_sent(
    monkeypatch,
):
    """Absent, not empty.

    A provider that has never heard of the field must see the same bytes it saw
    before the setting existed, and one that has must not be told "no effort" by
    a variable nobody set.
    """
    monkeypatch.setattr(settings, "llm_reasoning_effort", "")

    body = _sent_body(monkeypatch)

    assert "reasoning_effort" not in body
    assert body["max_tokens"] == settings.max_tokens_per_dimension


@pytest.mark.parametrize("effort", sorted(SUPPORTED_REASONING_EFFORTS))
def test_a_configured_effort_reaches_the_provider(monkeypatch, effort):
    monkeypatch.setattr(settings, "llm_reasoning_effort", effort)

    body = _sent_body(monkeypatch)

    assert body["reasoning_effort"] == effort
    # The cap and the effort answer different questions and both travel: one
    # bounds what an answer may cost, the other what it does cost.
    assert body["max_tokens"] == settings.max_tokens_per_dimension


def test_the_value_is_read_case_and_space_insensitively(monkeypatch):
    monkeypatch.delenv("LLM_REASONING_EFFORT", raising=False)
    monkeypatch.setenv("LLM_REASONING_EFFORT", "  LOW ")

    configured = Settings()

    assert configured.llm_reasoning_effort == "low"
    assert configured.llm_reasoning_effort_configuration_error == ""


def test_an_unsupported_effort_is_refused_rather_than_forwarded(monkeypatch):
    """A typo costs the previous behaviour, not the round.

    Forwarded, `reasoning_effert: hihg` is a `400` on every one of the round's
    twenty-eight calls — every dimension on the deterministic sentence, and a
    run that reports success. Refused, it is the bill this service was already
    paying plus a configuration error that names the variable.
    """
    monkeypatch.setenv("LLM_REASONING_EFFORT", "hihg")

    configured = Settings()

    assert configured.llm_reasoning_effort == ""
    assert "LLM_REASONING_EFFORT" in (
        configured.llm_reasoning_effort_configuration_error
    )
    assert "hihg" in configured.llm_reasoning_effort_configuration_error


def test_the_configuration_error_reaches_the_runtime_check(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("USE_MOCK_MCP", "false")
    monkeypatch.setenv("MCP_SHARED_SECRET", "mcp-secret")
    monkeypatch.setenv("AI_WEBHOOK_SECRET", "webhook-secret")
    monkeypatch.setenv("AI_CALLBACK_SECRET", "callback-secret")
    monkeypatch.setenv(
        "DATA_LAYER_MCP_URL",
        "https://data-layer.example/api/mcp",
    )
    monkeypatch.setenv(
        "DATA_LAYER_CALLBACK_URL",
        "https://data-layer.example/api/rounds",
    )
    monkeypatch.setenv("LLM_REASONING_EFFORT", "maximum")

    configured = Settings()

    assert any(
        "LLM_REASONING_EFFORT" in error
        for error in configured.runtime_configuration_errors()
    )
