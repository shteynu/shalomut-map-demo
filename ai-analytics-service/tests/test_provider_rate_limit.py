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

A pace is only meaningful beside a model, because that is the unit the provider
counts in, and the heavy tier is the one that pays for forgetting it: a replay
switches to a model whose tier is three times stricter. So the
queue is keyed by model name, and the tests below hold both halves of that —
each model kept to its own limit, and no model slowed down by another's.
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


def _configure_two_paces(monkeypatch, *, fast_rate, heavy_rate):
    """Two models on one key, each with the pace its own tier allows.

    This is the deployment's shape: the fast model is paced at what its tier
    permits, and the heavy one has a stricter tier of its own. The interval is
    not derived here, unlike in `_configure_pace`, because zero is a rate a
    caller is allowed to ask for and it means "unpaced" rather than "instant".
    """
    configure_gemini_retry_test(monkeypatch)
    monkeypatch.setattr(settings, "llm_max_requests_per_minute", fast_rate)
    monkeypatch.setattr(settings, "llm_model_heavy", "gemini-test-heavy")
    monkeypatch.setattr(
        settings,
        "llm_max_requests_per_minute_heavy",
        heavy_rate,
    )
    provider_rate_limiter.reset()


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
    # a quarter of the budget it must not lose. The same model, because a
    # booking against another one would not be in this call's way at all.
    provider_rate_limiter.book(model=settings.llm_model_fast)
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
    model = settings.llm_model_fast

    assert provider_rate_limiter.book(model=model) == 0.0
    assert provider_rate_limiter.book(model=model, max_wait=0.5) is None
    assert provider_rate_limiter.book(model=model) == pytest.approx(
        1.0,
        abs=0.05,
    )


def test_the_heavy_tier_is_paced_at_its_own_limit(monkeypatch):
    """A replayed node reaches the heavy model at the heavy model's pace.

    This is the whole item. `retry_tier` switches the model, and back then it
    switched a whole node at once, so a replay sent every problematic dimension
    to the heavy model back to back — at the fast model's pace, which the
    deployment tunes to a tier the heavy model does not have. Quotas are
    counted per model, so that is not a bigger share of one budget; it is
    roughly three times the other budget. A replay is narrow now
    (`test_replay_targets.py`), and the pace still has to be the heavy model's.
    """
    _configure_two_paces(monkeypatch, fast_rate=600.0, heavy_rate=60.0)
    sent_at = []

    def fake_urlopen(*_args, **_kwargs):
        sent_at.append(monotonic())
        return FakeLLMResponse(ACCEPTED_HEBREW)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    for _ in range(2):
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
            retry_tier="heavy",
        )

    assert len(sent_at) == 2
    # One second apart, not the tenth of a second the fast tier would allow.
    assert sent_at[1] - sent_at[0] >= 1.0 - 0.02


def test_a_slow_model_does_not_hold_up_a_fast_one(monkeypatch):
    """One queue per model, because that is how the provider counts.

    A single process-wide queue would be safe and wrong in the other
    direction: every ordinary round, which never touches the heavy model at
    all, would be paced at the strictest tier on the key.
    """
    _configure_two_paces(monkeypatch, fast_rate=60.0, heavy_rate=6.0)

    # The heavy model takes a ten-second turn, and the fast model's next turn
    # is unaffected by it.
    assert provider_rate_limiter.book(model="gemini-test-heavy") == 0.0
    assert provider_rate_limiter.book(model="gemini-test-model") == 0.0
    assert provider_rate_limiter.book(
        model="gemini-test-heavy",
    ) == pytest.approx(10.0, abs=0.05)
    assert provider_rate_limiter.book(
        model="gemini-test-model",
    ) == pytest.approx(1.0, abs=0.05)


def test_two_tiers_on_one_model_share_one_queue(monkeypatch):
    """Naming the same model twice must not buy twice the quota.

    Pointing `LLM_MODEL_HEAVY` at the fast model is a reasonable way to run
    this service, and the key is the model name precisely so that choice needs
    no code: one name, one bucket, and the stricter of the two paces.
    """
    _configure_pace(monkeypatch, 60.0)
    monkeypatch.setattr(settings, "llm_model_heavy", "gemini-test-model")
    monkeypatch.setattr(settings, "llm_max_requests_per_minute_heavy", 6.0)
    provider_rate_limiter.reset()

    assert provider_rate_limiter.book(model="gemini-test-model") == 0.0
    # The second booking waits the stricter tier's ten seconds, and it waits
    # them whichever tier asked: there is one queue because there is one model.
    assert provider_rate_limiter.book(
        model="gemini-test-model",
    ) == pytest.approx(10.0, abs=0.05)


def test_an_unrecognised_model_gets_the_strictest_pace(monkeypatch):
    """A model nobody configured has a budget nobody knows.

    Same reasoning as the conservative default: an unknown quota is not an
    absent one, so the strictest pace on the key is the only safe guess.
    """
    _configure_two_paces(monkeypatch, fast_rate=60.0, heavy_rate=6.0)

    assert provider_rate_limiter.book(model="gemini-unconfigured") == 0.0
    assert provider_rate_limiter.book(
        model="gemini-unconfigured",
    ) == pytest.approx(10.0, abs=0.05)


def test_the_heavy_pace_is_its_own_setting(monkeypatch):
    """The heavy pace defaults to the strict tier, not to the fast setting.

    Inheriting the fast number when unset would rebuild the defect the moment
    the deployment raised the fast one — which is exactly how it arose: the
    pace moved to fourteen with the fast model and the heavy model kept
    borrowing it.
    """
    for variable in ("LLM_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.delenv(variable, raising=False)

    monkeypatch.delenv("LLM_MAX_REQUESTS_PER_MINUTE_HEAVY", raising=False)
    monkeypatch.setenv("LLM_MAX_REQUESTS_PER_MINUTE", "14")
    assert Settings().llm_max_requests_per_minute_heavy == 5.0

    monkeypatch.setenv("LLM_MAX_REQUESTS_PER_MINUTE_HEAVY", "2")
    assert Settings().llm_max_requests_per_minute_heavy == 2.0

    monkeypatch.setenv("LLM_MAX_REQUESTS_PER_MINUTE_HEAVY", "-1")
    assert Settings().llm_max_requests_per_minute_heavy == 0.0


def test_zero_turns_one_model_off_without_freeing_the_other(monkeypatch):
    """Zero means unpaced, and it means it for one model only.

    A paid fast tier is a realistic reason to turn pacing off for it, and the
    strictest-pace rule must read that as "no limit" rather than as the
    smallest number it has seen.
    """
    _configure_two_paces(monkeypatch, fast_rate=0.0, heavy_rate=6.0)

    assert provider_rate_limiter.book(model="gemini-test-model") == 0.0
    assert provider_rate_limiter.book(model="gemini-test-model") == 0.0
    assert provider_rate_limiter.book(model="gemini-test-heavy") == 0.0
    assert provider_rate_limiter.book(
        model="gemini-test-heavy",
    ) == pytest.approx(10.0, abs=0.05)
    # And an unknown model still gets the strictest *positive* pace, not the
    # zero that would read as "no limit anywhere".
    assert provider_rate_limiter.book(model="gemini-unconfigured") == 0.0
    assert provider_rate_limiter.book(
        model="gemini-unconfigured",
    ) == pytest.approx(10.0, abs=0.05)


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


def test_a_second_sending_process_halves_this_one_s_pace(monkeypatch):
    """Two processes on one key send at the rate one process would.

    The quota is counted per key, so before this the second process was pure
    overspend: two private queues, each certain it was the whole account's
    traffic. The test measures it where it matters — the gap between two sends
    of *this* process, which has to double when it learns it is one of two.
    """
    interval = _configure_pace(monkeypatch, 120.0)
    provider_rate_limiter.set_sending_processes(2)
    sent_at = []

    def fake_urlopen(*_args, **_kwargs):
        sent_at.append(monotonic())
        return FakeLLMResponse(ACCEPTED_HEBREW)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    for _ in range(3):
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
        )

    assert min(_gaps(sent_at)) >= 2 * interval - 0.02


def test_one_process_paces_exactly_as_it_always_did(monkeypatch):
    """A fleet of one divides by one, which is the deployment today.

    Worth its own test because the division is now on the path of every send:
    a bug that read "one sender" as "no senders" or as "one extra" would slow
    every ordinary round, and nothing else here would notice.
    """
    alone_interval, alone = _send_times(monkeypatch, 120.0)
    provider_rate_limiter.set_sending_processes(1)
    declared_interval, declared = _send_times(monkeypatch, 120.0)

    assert declared_interval == alone_interval
    assert abs(max(_gaps(declared)) - max(_gaps(alone))) < 0.05


def test_a_count_below_one_is_read_as_one(monkeypatch):
    """Nobody sending is a failure to count, not a licence to flood.

    Zero senders would make the interval zero — an unpaced process, which is
    the exact failure this whole module exists to prevent — so the floor is
    part of the invariant rather than defensive habit.
    """
    interval = _configure_pace(monkeypatch, 120.0)
    provider_rate_limiter.set_sending_processes(0)

    first = provider_rate_limiter.book(model=settings.llm_model_fast)
    second = provider_rate_limiter.book(model=settings.llm_model_fast)

    assert first == 0.0
    # The tolerance is the microseconds between the two bookings, not slack in
    # the rule: a floor read as zero senders would have made this exactly 0.0.
    assert second >= interval - 0.02


def test_an_unpaced_tier_stays_unpaced_however_many_processes_send(monkeypatch):
    """Zero means "no limit", and no limit divided is still no limit."""
    _configure_two_paces(monkeypatch, fast_rate=0.0, heavy_rate=5.0)
    provider_rate_limiter.set_sending_processes(4)

    assert provider_rate_limiter.book(model=settings.llm_model_fast) == 0.0
    assert provider_rate_limiter.book(model=settings.llm_model_fast) == 0.0
