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
UptimeRobot keyword monitor alerts when the body contains `failing`, so the three
literals below are not free to be renamed for readability — a rename silences the
alert rather than breaking anything visibly, which is the worst way for a
watchdog to fail. `tests/test_provider_health.py` pins them for that reason, and
`docs/shalomut-tracker-handoff.md` records the monitor itself.

The monitor watches for `failing` rather than the absence of `answering`,
deliberately: `unknown` is the honest state of a process that has restarted or
that nobody has used, and alerting on it would page a human for silence.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, Optional

# Wall-clock is what a human reading the answer needs; monotonic is what an
# elapsed-seconds figure needs. Keeping both avoids a reading that goes backwards
# when the host adjusts its clock.
_STARTED_AT_WALL = time.time()
_STARTED_AT_MONOTONIC = time.monotonic()

_lock = threading.Lock()
_last: Optional[Dict[str, Any]] = None
_succeeded = 0
_failed = 0


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
        "observedSince": _iso(_STARTED_AT_WALL),
        "observedForSeconds": round(uptime, 1),
    }


def reset_provider_health_for_tests() -> None:
    global _last, _succeeded, _failed
    with _lock:
        _last = None
        _succeeded = 0
        _failed = 0


def _iso(epoch_seconds: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(epoch_seconds))
