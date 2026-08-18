"""Answering "is the model alive?" without a dashboard and without a log.

The question cost a whole session on 2026-08-17: the deployed suggestion button
had been failing on a depleted provider prepayment, and the only witness was a
log line on Render. These tests hold the three things that make the replacement
trustworthy — that every provider outcome is recorded whichever way the transport
exits, that a process which has seen nothing says so instead of saying "ok", and
that the reading is closed to an unauthenticated caller.

The same recording answers a second question, and the tests for it are at the
bottom of this file: how much of the recent copy the model actually wrote. The
incident behind that one is 2026-08-09, when every one of eight stones came out
of the deterministic fallback and the round still reported success — a state the
`answering`/`failing` word cannot express, because the last conversation of a
half-written map can be a successful one.
"""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.config import settings
from src.main import app
from src.services.llm_provider import llm_provider_service
from src.services.llm_transport import complete_with_retries
from src.services.provider_health import (
    read_fallback_health,
    record_provider_attempt,
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


def test_the_status_literals_are_a_contract_with_the_external_monitor(monkeypatch):
    """The three strings an UptimeRobot keyword monitor matches on.

    Pinned because renaming one would not break anything visibly: the monitor
    stops finding `failing`, reports Up forever, and the alert this whole line of
    work exists for is silently gone. A watchdog that fails quiet is worse than
    no watchdog, so the rename has to fail here first.
    """
    assert read_provider_health()["status"] == "unknown"

    _run_transport(monkeypatch, urlopen=lambda *a, **k: _Answering())
    assert read_provider_health()["status"] == "answering"

    _run_transport(monkeypatch, api_key="")
    assert read_provider_health()["status"] == "failing"

    # And the one the monitor keys on must not appear in either quiet state:
    # `unknown` is a restarted or unused process, not a fault, and alerting on it
    # would page a human for silence.
    reset_provider_health_for_tests()
    assert "failing" not in json.dumps(read_provider_health())

    _run_transport(monkeypatch, urlopen=lambda *a, **k: _Answering())
    assert "failing" not in json.dumps(read_provider_health())


def test_the_anonymous_status_word_is_readable_without_a_secret(monkeypatch):
    # The whole reason this endpoint exists: UptimeRobot's free plan cannot send
    # a request header, so a watchdog has nothing else it could read.
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "ai_webhook_secret", "webhook-secret")

    response = client.get("/api/v1/provider-status")

    assert response.status_code == 200
    assert response.json() == {"status": "unknown"}


def test_the_anonymous_status_publishes_the_word_and_nothing_else(monkeypatch):
    """The disclosure boundary, enforced rather than intended.

    The reason, the model, the counts and the timing are what turn "the model is
    down" into "the account has no credit". They stay behind the secret, and a
    field added to the full reading later must not arrive here by being
    forgotten.
    """
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
    monkeypatch.setattr(settings, "env", "development")
    monkeypatch.setattr(settings, "ai_webhook_secret", "")

    body = client.get("/api/v1/provider-status").json()

    assert body == {"status": "failing"}
    assert list(body) == ["status"]

    serialized = json.dumps(body)
    for withheld in ("http_429", "gemini", "attempts", "observedSince", "reason"):
        assert withheld not in serialized, withheld

    # And the secret-gated reading still carries all of it, so nothing was lost —
    # it was only moved out of anonymous reach.
    full = client.get("/api/v1/provider-health").json()
    assert full["lastAttempt"]["reason"] == "http_429"


def test_the_anonymous_health_endpoint_says_nothing_about_the_provider():
    # The boundary this placement exists for. `/health` is anonymous, so a
    # provider or credential fact appearing there would be published to anyone.
    body = client.get("/health").json()

    serialized = json.dumps(body)
    for leak in ("provider", "lastAttempt", "http_429", "gemini", "apiKey"):
        assert leak not in serialized, leak


# The window tests record through `record_provider_attempt` rather than through
# the transport, and the reason is worth stating: the process paces itself. Every
# send books a turn on the model's queue, so a second conversation in the same
# test waits the deployed interval — six seconds on the fast tier — and a test
# that needs a window of twenty would sit there for two minutes proving nothing
# about the window.
#
# What that trades away is the tie between the window and real work, so it is not
# traded away: `test_the_two_watchdogs_do_not_share_a_body` below drives the real
# transport, and the recording point itself is already pinned by the transport
# tests above, including the exit that returns before any HTTP.


def _answering(times):
    for _ in range(times):
        record_provider_attempt(
            model_name="gemini-3.5-flash",
            attempts=1,
            reason="",
        )


def _falling_back(times, reason="http_429"):
    # The window does not read the reason, only whether the conversation produced
    # an answer. `http_429` is the one the deployment actually produced.
    for _ in range(times):
        record_provider_attempt(
            model_name="gemini-3.5-flash",
            attempts=1,
            reason=reason,
        )


def test_too_small_a_sample_is_unknown_rather_than_healthy():
    _falling_back(3)

    reading = read_fallback_health()

    # Three failures out of three is not a ratio, it is a restarted process on a
    # bad minute. Reporting `degraded` here would page a human for it, and
    # reporting `writing` would be a lie in the other direction.
    assert reading["status"] == "unknown"
    assert reading["fellBackRatio"] is None
    assert reading["window"]["observed"] == 3
    assert reading["window"]["fellBack"] == 3


def test_a_model_that_writes_the_map_reads_as_writing():
    _answering(6)

    reading = read_fallback_health()

    assert reading["status"] == "writing"
    assert reading["fellBackRatio"] == 0.0
    assert reading["window"] == {
        "observed": 6,
        "fellBack": 0,
        "capacity": 20,
        "minimumSample": 5,
    }


def test_a_map_mostly_derived_by_the_service_reads_as_degraded():
    _falling_back(6)
    _answering(2)

    reading = read_fallback_health()

    # 6 of 8, which is the shape of the 2026-08-09 incident: the run succeeds,
    # the stones are real, and most of the prose is derived from the aggregates.
    assert reading["status"] == "degraded"
    assert reading["fellBackRatio"] == 0.75


def test_exactly_half_is_not_degraded():
    _falling_back(4)
    _answering(4)

    # The threshold is strict, and which side of it half falls on is the kind of
    # thing an alert is silently re-tuned by. Pinned so the tuning is a diff.
    assert read_fallback_health()["fellBackRatio"] == 0.5
    assert read_fallback_health()["status"] == "writing"


def test_a_recovered_model_clears_the_alert_by_itself():
    _falling_back(20)
    assert read_fallback_health()["status"] == "degraded"

    # The window is bounded, so a bad afternoon leaves on its own once real work
    # succeeds again. A since-start ratio would hold this alert open for the life
    # of the process, and an alert that cannot clear is one nobody keeps.
    _answering(20)

    reading = read_fallback_health()
    assert reading["status"] == "writing"
    assert reading["window"]["observed"] == 20
    assert reading["window"]["fellBack"] == 0


def test_a_dimension_never_asked_does_not_count_against_the_model(monkeypatch):
    """The green skip is not a degradation, and this is where that is decided.

    `ONLY_LLM_FOR_PROBLEMATIC` returns a green dimension's copy without calling
    the provider at all. Core labels that stone `deterministic_fallback` — which
    is right for a per-round provenance record and would be a false page here,
    because nothing failed. Feeding this window from the transport rather than
    from the stone outcomes is what excludes it, so the exclusion is a property
    of where the recording happens and is pinned here.
    """
    monkeypatch.setattr(settings, "only_llm_for_problematic", True)
    _answering(6)

    generation = llm_provider_service.generate_psychological_interpretation_result(
        "meaning",
        "משמעות",
        82.0,
        "green",
        question_aggregates=[],
        contract_version="5.0",
    )

    assert generation.outcome == "deterministic_fallback"
    assert generation.attempts == 0
    # The conversation never happened, so the window never heard about it.
    reading = read_fallback_health()
    assert reading["window"]["observed"] == 6
    assert reading["window"]["fellBack"] == 0
    assert reading["status"] == "writing"


def test_the_fallback_literals_are_a_contract_with_the_external_monitor():
    """The three strings the map's own UptimeRobot monitor matches on.

    Pinned for the same reason as the provider literals above: a rename does not
    fail visibly, it makes the monitor report Up forever.
    """
    assert read_fallback_health()["status"] == "unknown"

    _answering(5)
    assert read_fallback_health()["status"] == "writing"

    reset_provider_health_for_tests()
    _falling_back(5)
    assert read_fallback_health()["status"] == "degraded"

    # And the word the monitor keys on must not appear in either quiet state.
    reset_provider_health_for_tests()
    assert "degraded" not in json.dumps(read_fallback_health())

    _answering(5)
    assert "degraded" not in json.dumps(read_fallback_health())


def test_the_two_watchdogs_do_not_share_a_body(monkeypatch):
    """Neither monitor's keyword may appear in the other's document.

    They answer different questions off one recording, and the failure this
    guards is not hypothetical — a last conversation that succeeded reads
    `answering` while the window is still mostly fallback. If the words shared a
    body, one alert would clear the other.
    """
    for _ in range(6):
        _run_transport(monkeypatch, api_key="")
    _run_transport(monkeypatch, urlopen=lambda *a, **k: _Answering())

    provider = client.get("/api/v1/provider-status").json()
    fallback = client.get("/api/v1/fallback-status").json()

    assert provider == {"status": "answering"}
    assert fallback == {"status": "degraded"}


def test_the_anonymous_fallback_word_is_readable_without_a_secret(monkeypatch):
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "ai_webhook_secret", "webhook-secret")

    response = client.get("/api/v1/fallback-status")

    assert response.status_code == 200
    # One key. The ratio, the window and the counts are what turn "the map is
    # derived" into "the key is rate-limited", and they stay behind the secret.
    assert response.json() == {"status": "unknown"}


def test_the_authenticated_reading_carries_the_window(monkeypatch):
    monkeypatch.setattr(settings, "env", "development")
    monkeypatch.setattr(settings, "ai_webhook_secret", "")
    _falling_back(5)

    body = client.get("/api/v1/provider-health").json()

    # One request for whoever operates the service: the last attempt and how the
    # recent window is going, without a second round trip.
    assert body["status"] == "failing"
    assert body["recent"]["status"] == "degraded"
    assert body["recent"]["fellBackRatio"] == 1.0
    assert body["recent"]["alertsAbove"] == 0.5
