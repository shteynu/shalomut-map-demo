"""The pace toward the provider — the one thing no round had until now.

Every live round so far failed the same way: the model answered, and the
provider refused the rest of the round on `429`. Not for what the requests said
(the largest is 1401 characters, and input tokens ran at three per cent of the
allowance) but for how many arrived per minute. `LLM_MAX_CONCURRENT_REQUESTS`
bounds only how many are in flight, so seventeen requests still crossed a
five-per-minute tier inside a single minute.

The invariant needs two tests, not one: the first requires the interval to be
kept, and the second raises the limit and requires the pace to rise with it —
without which a run that happened to be serial would satisfy the first on its
own. The rest guard what the pace must not cost: a retry's place in the queue,
a call's retry budget, and a turn refused without charging the next caller.
"""

from time import monotonic

import json

import pytest
from src.config import Settings, settings
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)
from src.services.provider_rate_limit import provider_rate_limiter

from tests.test_llm_provider import (
    FakeLLMResponse,
    configure_gemini_retry_test,
    create_http_error,
)

ACCEPTED_HEBREW = (
    "התקבלה תוצאה אמיתית מן המודל. "
    "הפירוש נשען על הנתונים המצרפיים."
)


def _configure_pace(monkeypatch, requests_per_minute):
    """A transport that answers instantly, at a pace of our choosing."""
    configure_gemini_retry_test(monkeypatch)
    monkeypatch.setattr(
        settings,
        "llm_max_requests_per_minute",
        requests_per_minute,
    )
    provider_rate_limiter.reset()
    return 60.0 / requests_per_minute


def _send_times(monkeypatch, requests_per_minute, sends=3):
    """When each of `sends` interpretations actually reached the provider."""
    interval = _configure_pace(monkeypatch, requests_per_minute)
    sent_at = []

    def fake_urlopen(*_args, **_kwargs):
        sent_at.append(monotonic())
        return FakeLLMResponse(ACCEPTED_HEBREW)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    for _ in range(sends):
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
        )

    assert len(sent_at) == sends
    return interval, sent_at


def _gaps(sent_at):
    return [
        later - earlier
        for earlier, later in zip(sent_at, sent_at[1:])
    ]


def test_requests_are_spaced_by_the_configured_interval(monkeypatch):
    """Consecutive requests are at least one interval apart.

    Measured where it counts — at the send itself — rather than at the booking,
    so a queue that hands out turns correctly and then ignores them fails here.
    """
    interval, sent_at = _send_times(monkeypatch, 120.0)

    # `sleep` returns late, never early, and the first send never sleeps at
    # all, so three sends occupy at least two whole intervals however loaded
    # the machine is. This is the invariant, exactly.
    assert sent_at[-1] - sent_at[0] >= (len(sent_at) - 1) * interval
    # Said the other way round, about the pair the quota is counted over. The
    # slack is `sleep` overshooting on one send and not the next, which moves a
    # measured gap by milliseconds without ever moving a send earlier than the
    # turn it was booked for.
    assert min(_gaps(sent_at)) >= interval - 0.02


def test_a_higher_limit_really_does_raise_the_pace(monkeypatch):
    """A raised limit widens the flow, so the interval above causes it.

    Without this, a run that was serial by accident — a stub that answers in
    microseconds, a machine under load — would satisfy the test above just as
    well as a working queue.
    """
    slow_interval, _ = _send_times(monkeypatch, 120.0)
    fast_interval, fast_sends = _send_times(monkeypatch, 600.0)

    assert fast_sends[-1] - fast_sends[0] >= (
        (len(fast_sends) - 1) * fast_interval
    )
    # Three requests at the higher rate finish inside a single gap of the lower
    # one: the pace follows the setting, it is not a fixed sleep.
    assert fast_sends[-1] - fast_sends[0] < slow_interval


def test_a_retry_after_429_waits_for_the_next_turn(monkeypatch):
    """The retry a `429` deserves is one in the next window.

    This is the failure the deployed service kept meeting: three attempts 0.5
    and 1.1 seconds apart all fell inside the minute that had just refused
    them, and asked the same exhausted quota the same question three times.
    """
    interval = _configure_pace(monkeypatch, 120.0)
    responses = iter(
        [
            create_http_error(
                429,
                body=json.dumps(
                    {"error": {"status": "RESOURCE_EXHAUSTED"}},
                ).encode("utf-8"),
            ),
            FakeLLMResponse(ACCEPTED_HEBREW),
        ],
    )
    sent_at = []

    def fake_urlopen(*_args, **_kwargs):
        sent_at.append(monotonic())
        response = next(responses)
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert result == ACCEPTED_HEBREW
    # The configured backoff for this test is zero, so any gap here is the
    # queue's doing and nothing else's.
    assert len(sent_at) == 2
    assert sent_at[1] - sent_at[0] >= interval


def test_waiting_for_a_turn_does_not_spend_the_retry_budget(monkeypatch):
    """A request that queued for its turn still gets its whole budget.

    The wait belongs to the account's rate limit, not to this call. Charged the
    other way, a request that waited would reach the provider with the remains
    of its budget and time out on a provider that was merely slow.
    """
    _configure_pace(monkeypatch, 120.0)
    monkeypatch.setattr(settings, "llm_retry_budget_seconds", 2.0)
    monkeypatch.setattr(settings, "llm_request_timeout_seconds", 2.0)
    # Somebody else just sent, so this call waits half a second for its turn —
    # a quarter of the budget it must not lose.
    provider_rate_limiter.book()
    observed_timeouts = []

    def fake_urlopen(*_args, timeout=None, **_kwargs):
        observed_timeouts.append(timeout)
        return FakeLLMResponse(ACCEPTED_HEBREW)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    # The request is given the whole two seconds. Charged the other way it
    # would have reached the provider with the one and a half it had left.
    assert observed_timeouts == [pytest.approx(2.0, abs=0.05)]


def test_a_retry_after_beyond_the_budget_stops_the_retry(monkeypatch):
    """A wait the budget cannot hold ends the call instead of being shortened.

    The provider asking for thirty seconds inside a twenty-five second budget
    has said there is nothing to come back to. Retrying earlier only spends
    another request on the same refusal.
    """
    _configure_pace(monkeypatch, 300.0)
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise create_http_error(
            429,
            body=json.dumps(
                {"error": {"status": "RESOURCE_EXHAUSTED"}},
            ).encode("utf-8"),
            headers={"Retry-After": "30"},
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
        )

    assert failure.value.reason == "http_429"
    assert len(attempts) == 1


def test_a_refused_turn_leaves_the_queue_untouched(monkeypatch):
    """Refusing a turn costs nobody else their place.

    A booking that is declined must not push the next caller a whole interval
    into the future for a request that was never sent.
    """
    monkeypatch.setattr(settings, "llm_max_requests_per_minute", 60.0)
    provider_rate_limiter.reset()

    assert provider_rate_limiter.book() == 0.0
    assert provider_rate_limiter.book(max_wait=0.5) is None
    assert provider_rate_limiter.book() == pytest.approx(1.0, abs=0.05)


def test_requests_per_minute_comes_from_the_environment(monkeypatch):
    """The pace is tunable without a code change, and defaults to the tier.

    Five is what Google's free tier allows for `gemini-3.5-flash`, read on
    2026-07-29. A paid tier raises it; zero turns pacing off entirely.
    """
    for variable in ("LLM_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.delenv(variable, raising=False)

    monkeypatch.delenv("LLM_MAX_REQUESTS_PER_MINUTE", raising=False)
    assert Settings().llm_max_requests_per_minute == 5.0

    monkeypatch.setenv("LLM_MAX_REQUESTS_PER_MINUTE", "60")
    assert Settings().llm_max_requests_per_minute == 60.0

    monkeypatch.setenv("LLM_MAX_REQUESTS_PER_MINUTE", "-1")
    assert Settings().llm_max_requests_per_minute == 0.0
