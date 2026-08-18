"""What the provider last said, so "is the model alive?" has a cheap answer.

The question used to cost a session. On 2026-08-17 the deployed suggestion
button had been answering `503` for an unknown length of time because the
provider account's prepayment was depleted, and establishing that took four
hand-made requests, a read of `main.py` and a signed-in look at the service's
own log on Render. The knowledge existed only in log lines, which expire and
which nobody reads without already suspecting something.

This module keeps the last outcome in memory and nothing else. Deliberately not
persisted: the fact is about this process right now, a database write on the
provider path would add a failure mode to the path that is already failing, and
a stale row read after a redeploy is worse than an honest "unknown".

**Absence of a failure is not health, and the reader must be able to tell.**
Nothing here calls the provider — the state only moves when real work does, and
the provider is reached only by a question suggestion or a round's analysis. So a
quiet service and a healthy one look identical from the inside, and the reading
carries `observedSince` plus a count of what has actually been seen so that the
difference is visible rather than assumed. A process that has recorded nothing
says so.

Thread-safe because it is written from worker threads: the provider call runs
under `asyncio.to_thread`, so a record can arrive on any of them while a request
handler reads.

**`status` is a wire contract with something outside this repository.** An
UptimeRobot keyword monitor reads it anonymously through `read_provider_status`
and alerts when the body contains `failing`, so the three literals below are not
free to be renamed for readability — a rename silences the alert rather than
breaking anything visibly, which is the worst way for a watchdog to fail.
`tests/test_provider_health.py` pins them for that reason, and
`docs/shalomut-tracker-handoff.md` records the monitor itself.

The monitor watches for `failing` rather than the absence of `answering`,
deliberately: `unknown` is the honest state of a process that has restarted or
that nobody has used, and alerting on it would page a human for silence.

**A second reading lives here, off the same recording.** `status` above follows
the *last* attempt, which is the right shape for "is the model down" and the
wrong one for "how much of the map did the model actually write". A round whose
last conversation succeeded reads `answering` while five of its eight dimensions
carry copy the service derived from the aggregates — which is what happened on
2026-08-09, when every one of eight stones came from the fallback and the round
reported success. `read_fallback_health` answers that question from a bounded
window of recent conversations, and `read_fallback_status` is its own one-word
wire contract, on its own path, with its own literals.

It is fed by `record_provider_attempt` rather than by a second hook at the
fallback sites, for the reason `llm_transport.complete_with_retries` gives for
wrapping instead of recording beside each exit: the one place that must not be
forgotten is the one place that cannot be.

That choice also decides what the window does *not* count, and the exclusion is
the point rather than a limitation. `ONLY_LLM_FOR_PROBLEMATIC` skips the
provider entirely for a green dimension — no conversation, so nothing recorded —
and that stone still reaches Core labelled `deterministic_fallback`. Core's
`ai_deterministic_summary_ratio_sample` therefore counts a working token
optimization as fallback, which is correct for a per-round provenance record and
would be a false page here. The window counts conversations that happened, so
what it measures is the model failing to write, never the service choosing not
to ask.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional

# Wall-clock is what a human reading the answer needs; monotonic is what an
# elapsed-seconds figure needs. Keeping both avoids a reading that goes backwards
# when the host adjusts its clock.
_STARTED_AT_WALL = time.time()
_STARTED_AT_MONOTONIC = time.monotonic()

_lock = threading.Lock()
_last: Optional[Dict[str, Any]] = None
_succeeded = 0
_failed = 0

# How many recent conversations the fallback reading looks at.
#
# Bounded rather than since-start, because an alert that cannot clear itself is
# an alert nobody keeps: one bad afternoon would hold the ratio above the line
# for the rest of the process's life, and a since-start reading on a long-lived
# Render instance is mostly history. Twenty is about two rounds' worth of
# conversations, so a single degraded round moves it and a single degraded
# dimension does not.
_RECENT_WINDOW = 20

# Below this many observed conversations the reading is `unknown`, not healthy
# and not degraded. One failure out of one is not a ratio, and paging on it
# would mean a restarted process plus one `http_429` wakes a human.
_MINIMUM_SAMPLE = 5

# The line. Above it — strictly — the reading is `degraded`.
#
# A product judgement, not a derived constant, and it belongs to the owner: half
# is the point where a map is more derived text than model-written text, which
# is the weakest claim that is still obviously worth waking up for. Lower would
# catch the partial degradation earlier and page more often, and this is the
# only alerting channel the product has, so a false page costs the channel.
# `docs/shalomut-tracker-handoff.md` records the figure; the exact ratio is on
# every metric line for anyone who wants to argue with it from data.
_DEGRADED_ABOVE = 0.5

_recent: Deque[bool] = deque(maxlen=_RECENT_WINDOW)


def record_provider_attempt(
    *,
    model_name: str,
    attempts: int,
    reason: str,
) -> None:
    """Record one finished provider conversation.

    `reason` is the transport's own fallback reason, empty exactly when the
    provider answered acceptably. It is not re-derived here: `http_429`,
    `missing_api_key` and `invalid_semantic_output` want three different fixes,
    and collapsing them into a boolean is how a reading stops being actionable.
    """
    global _last, _succeeded, _failed

    answered = reason == ""
    record = {
        "answered": answered,
        "reason": reason or None,
        "model": model_name,
        "attempts": attempts,
        "at": time.time(),
    }

    with _lock:
        _last = record
        _recent.append(answered)
        if answered:
            _succeeded += 1
        else:
            _failed += 1


def read_provider_health() -> Dict[str, Any]:
    """The reading, shaped so that "unknown" cannot be mistaken for "fine"."""
    with _lock:
        last = dict(_last) if _last is not None else None
        succeeded = _succeeded
        failed = _failed
        recent = list(_recent)

    uptime = time.monotonic() - _STARTED_AT_MONOTONIC

    if last is None:
        # The one state worth spelling out: this process has asked the provider
        # nothing, so it knows nothing. Saying `status: "ok"` here would be the
        # single most misleading thing this endpoint could do.
        return {
            "status": "unknown",
            "detail": "no provider call has been made since this process started",
            "lastAttempt": None,
            "attemptsSeen": {"succeeded": 0, "failed": 0},
            "recent": _recent_reading(recent),
            "observedSince": _iso(_STARTED_AT_WALL),
            "observedForSeconds": round(uptime, 1),
        }

    return {
        "status": "answering" if last["answered"] else "failing",
        "lastAttempt": {
            "answered": last["answered"],
            "reason": last["reason"],
            "model": last["model"],
            "attempts": last["attempts"],
            "at": _iso(last["at"]),
            "secondsAgo": round(max(0.0, time.time() - last["at"]), 1),
        },
        "attemptsSeen": {"succeeded": succeeded, "failed": failed},
        "recent": _recent_reading(recent),
        "observedSince": _iso(_STARTED_AT_WALL),
        "observedForSeconds": round(uptime, 1),
    }


def read_provider_status() -> Dict[str, Any]:
    """The one word an anonymous monitor is allowed to see, and nothing else.

    UptimeRobot's free plan cannot send a request header — verified in its own
    monitor form on 2026-08-17, where `Request headers` is locked to the paid
    tiers — so the secret-gated reading is unreachable to any free monitor, and a
    watchdog needs something anonymous to read.

    Owner decision, 2026-08-17: publish the status word alone rather than pay for
    headers, add a second monitoring service, or go without a watchdog. What
    becomes public is that the model is or is not answering right now. What stays
    behind the secret is everything that makes that actionable — the reason, the
    model, the counts and the timing. `http_429` reads as "the account has no
    credit"; `failing` does not distinguish it from an outage, a revoked key or a
    provider having a bad minute.

    Built by projecting one key out of the full reading rather than by assembling
    a second dict. A field added to `read_provider_health` later cannot leak here
    by being forgotten: it has to be named to escape.
    """
    return {"status": read_provider_health()["status"]}


def read_fallback_health() -> Dict[str, Any]:
    """How much of the recent copy the model wrote, with the sample beside it.

    Never a bare ratio. `1.0` over one conversation and `1.0` over twenty are the
    same number and different facts, so the window size, the count above the line
    and the threshold travel with it — a reader who disagrees with the threshold
    can apply their own without a second request.
    """
    with _lock:
        recent = list(_recent)

    return {
        **_recent_reading(recent),
        "observedSince": _iso(_STARTED_AT_WALL),
        "observedForSeconds": round(time.monotonic() - _STARTED_AT_MONOTONIC, 1),
    }


def read_fallback_status() -> Dict[str, Any]:
    """The one word the map's own monitor is allowed to see.

    `writing`, `degraded` or `unknown`, on their own path, for the reason
    `main.py` gives for not folding a second watchdog into an existing body: the
    provider monitor keys on `failing` in `/api/v1/provider-status`, and two
    monitors reading one document is how a change made for one silences the
    other.

    Same wire-contract rule as `read_provider_status`, and the same failure mode
    if it is broken: a renamed literal does not break a monitor visibly, it makes
    it report Up forever. `tests/test_provider_health.py` pins these three.

    The word for the fault is an adjective where the provider's is a participle,
    and that asymmetry is deliberate: `failing` arrives in an alert e-mail with
    no context and reads as a fault on its own, and so must this one. `deriving`
    is what the service is doing and would read as a status line.

    What becomes public is that the map is currently written by the model or not.
    That is the same class of fact as `answering` — a state of the product, not a
    state of the account — and the reason, the model and the counts stay behind
    the secret on `/api/v1/provider-health`, where they already are.
    """
    return {"status": read_fallback_health()["status"]}


def _recent_reading(recent: List[bool]) -> Dict[str, Any]:
    """The window as a reading. Pure, so both callers compute it identically.

    Taking a snapshot rather than the deque: `threading.Lock` is not reentrant,
    and `read_provider_health` already holds it when it needs this.
    """
    observed = len(recent)
    fell_back = sum(1 for answered in recent if not answered)

    if observed < _MINIMUM_SAMPLE:
        # Same rule as `status` above, for the same reason: a process that has
        # not seen enough to have an opinion says so rather than reporting the
        # healthy word. Silence is not health, and a small sample is not either.
        status = "unknown"
        ratio = None
    else:
        ratio = fell_back / observed
        status = "degraded" if ratio > _DEGRADED_ABOVE else "writing"

    return {
        "status": status,
        "fellBackRatio": None if ratio is None else round(ratio, 3),
        "window": {
            "observed": observed,
            "fellBack": fell_back,
            "capacity": _RECENT_WINDOW,
            "minimumSample": _MINIMUM_SAMPLE,
        },
        # `alertsAbove` rather than `degradedAbove`, and the awkward name is the
        # point: a field carrying the alert word puts that word in every reading,
        # including the healthy ones. The keyword monitor here reads the status
        # endpoint, which is one key and cannot be caught by it — but the next
        # monitor, or a log search for the word, would be. The test above pins
        # the absence, so this cannot drift back by someone preferring the
        # symmetrical name.
        "alertsAbove": _DEGRADED_ABOVE,
    }


def reset_provider_health_for_tests() -> None:
    global _last, _succeeded, _failed
    with _lock:
        _last = None
        _succeeded = 0
        _failed = 0
        _recent.clear()


def _iso(epoch_seconds: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(epoch_seconds))
