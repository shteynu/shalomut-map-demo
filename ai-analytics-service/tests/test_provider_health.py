"""Answering "is the model alive?" without a dashboard and without a log.

The question cost a whole session on 2026-08-17: the deployed suggestion button
had been failing on a depleted provider prepayment, and the only witness was a
log line on Render. These tests hold the three things that make the replacement
trustworthy — that every provider outcome is recorded whichever way the transport
exits, that a process which has seen nothing says so instead of saying "ok", and
that the reading is closed to an unauthenticated caller.
"""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.config import settings
from src.main import app
from src.services.llm_transport import complete_with_retries
from src.services.provider_health import (
    read_provider_health,
    reset_provider_health_for_tests,
)

client = TestClient(app)

ANSWER = "אני מרגישה שיש לי מסגרת ברורה לתכנון השבוע הקרוב."


@pytest.fixture(autouse=True)
def _clean_state():
    reset_provider_health_for_tests()
    yield
    reset_provider_health_for_tests()


class _Answering:
    status = 200

    def read(self):
        return json.dumps(
            {
                "choices": [
                    {
                        "message": {"content": ANSWER},
                        "finish_reason": "stop",
                    },
                ],
            },
        ).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def _run_transport(monkeypatch, *, api_key="sk-test-health", urlopen=None):
    monkeypatch.setattr(settings, "llm_api_key", api_key)
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)
    if urlopen is not None:
        monkeypatch.setattr("urllib.request.urlopen", urlopen)
    return complete_with_retries(
        build_prompt=lambda critique=None: "prompt",
        system_prompt="system",
        model_name="gemini-3.5-flash",
        is_acceptable=lambda text, finish_reason: bool(text),
    )


def test_a_process_that_has_asked_nothing_says_unknown_rather_than_ok():
    reading = read_provider_health()

    # The single most misleading thing this endpoint could do is call this "ok".
    assert reading["status"] == "unknown"
    assert reading["lastAttempt"] is None
    assert reading["attemptsSeen"] == {"succeeded": 0, "failed": 0}
    # And it must say how long it has been in a position to observe, so a caller
    # can tell "just restarted" from "nobody has used the feature".
    assert "observedSince" in reading
    assert reading["observedForSeconds"] >= 0


def test_an_answering_provider_is_reported_as_answering(monkeypatch):
    _run_transport(monkeypatch, urlopen=lambda *a, **k: _Answering())

    reading = read_provider_health()

    assert reading["status"] == "answering"
    assert reading["lastAttempt"]["answered"] is True
    assert reading["lastAttempt"]["reason"] is None
    assert reading["lastAttempt"]["model"] == "gemini-3.5-flash"
    assert reading["attemptsSeen"] == {"succeeded": 1, "failed": 0}


def test_a_refusing_provider_is_reported_with_the_reason_it_refused_with(
    monkeypatch,
):
    import urllib.error

    def refusing(*_a, **_k):
        raise urllib.error.HTTPError(
            "https://provider.local/v1/chat/completions",
            429,
            "Too Many Requests",
            {},
            None,
        )

    _run_transport(monkeypatch, urlopen=refusing)

    reading = read_provider_health()

    assert reading["status"] == "failing"
    assert reading["lastAttempt"]["answered"] is False
    # The reason the deployment actually produced on 2026-08-17. Not collapsed to
    # a boolean: http_429 and missing_api_key want different fixes.
    assert reading["lastAttempt"]["reason"] == "http_429"
    assert reading["attemptsSeen"] == {"succeeded": 0, "failed": 1}


def test_the_early_exit_is_recorded_too(monkeypatch):
    # `missing_api_key` returns before any HTTP is attempted, from a different
    # exit of the transport than either case above. It is recorded because the
    # recording wraps the function rather than sitting beside its returns — which
    # is the whole reason it is a wrapper.
    _run_transport(monkeypatch, api_key="")

    reading = read_provider_health()

    assert reading["status"] == "failing"
    assert reading["lastAttempt"]["reason"] == "missing_api_key"


def test_the_last_attempt_replaces_the_one_before_it(monkeypatch):
    _run_transport(monkeypatch, api_key="")
    _run_transport(monkeypatch, urlopen=lambda *a, **k: _Answering())

    reading = read_provider_health()

    # The status follows the latest attempt, and the counts remember both.
    assert reading["status"] == "answering"
    assert reading["attemptsSeen"] == {"succeeded": 1, "failed": 1}


def test_the_endpoint_answers_the_reading(monkeypatch):
    monkeypatch.setattr(settings, "env", "development")
    monkeypatch.setattr(settings, "ai_webhook_secret", "")

    response = client.get("/api/v1/provider-health")

    assert response.status_code == 200
    assert response.json()["status"] == "unknown"


def test_the_endpoint_refuses_an_unauthenticated_caller(monkeypatch):
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "ai_webhook_secret", "webhook-secret")

    assert client.get("/api/v1/provider-health").status_code == 401
    assert (
        client.get(
            "/api/v1/provider-health",
            headers={"Authorization": "Bearer wrong-secret"},
        ).status_code
        == 401
    )
    assert (
        client.get(
            "/api/v1/provider-health",
            headers={"Authorization": "Bearer webhook-secret"},
        ).status_code
        == 200
    )


def test_the_endpoint_requires_its_secret_outside_development(monkeypatch):
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "ai_webhook_secret", "")

    response = client.get("/api/v1/provider-health")

    assert response.status_code == 503


def test_the_anonymous_health_endpoint_says_nothing_about_the_provider():
    # The boundary this placement exists for. `/health` is anonymous, so a
    # provider or credential fact appearing there would be published to anyone.
    body = client.get("/health").json()

    serialized = json.dumps(body)
    for leak in ("provider", "lastAttempt", "http_429", "gemini", "apiKey"):
        assert leak not in serialized, leak
