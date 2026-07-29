"""How often this process may reach the provider, and nothing more.

A free tier counts three separate things: requests in flight, requests per
minute and requests per day. `LLM_MAX_CONCURRENT_REQUESTS` answers only the
first one. Seventeen requests handed through two concurrent slots still arrive
inside a single minute, and five per minute is what Google's free tier allows
for `gemini-3.5-flash` (limits read 2026-07-29) — which is why every live round
so far died on `429` while the model itself was answering.

The queue is one per process, because the quota is counted per key rather than
per round. Render runs the service with `WEB_CONCURRENCY=1` and one round at a
time, so this process is the whole account's traffic.

Booking a turn and waiting for it are separate steps on purpose: a retry has a
budget to answer to and must be able to refuse a turn it cannot afford, instead
of sleeping into it and discovering the budget is gone.

The clock is bound at import so that a test faking the transport's clock does
not silently fake the pace as well.
"""

import threading
from time import monotonic, sleep
from typing import Optional

from src.config import settings


class ProviderRateLimiter:
    """One booking queue for every request this process sends out."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._next_send_at: Optional[float] = None

    def book(
        self,
        *,
        min_delay: float = 0.0,
        max_wait: Optional[float] = None,
    ) -> Optional[float]:
        """Take the next turn and report how long the caller must wait for it.

        `min_delay` is a floor the caller brings along — a provider's own
        `Retry-After` outranks our interval when it asks for more than one, and
        never buys a send earlier than the pace allows when it asks for less.
        `max_wait` declines a turn the caller cannot afford, and the queue is
        left untouched then, so a caller that walks away costs nobody else
        their place.

        Returns the seconds to wait, or `None` when the turn was declined.
        """
        interval = self._interval_seconds()
        now = monotonic()
        with self._lock:
            booked = self._next_send_at
            earliest = booked if booked is not None else now
            wait = max(0.0, earliest - now, min_delay)
            if max_wait is not None and wait > max_wait:
                return None
            self._next_send_at = now + wait + interval
            return wait

    def wait(self, *, min_delay: float = 0.0) -> float:
        """Take the next turn and sleep until it. Returns the seconds slept."""
        # A turn is only ever declined against a `max_wait`, which this caller
        # does not bring: it waits however long the queue says.
        waited = self.book(min_delay=min_delay) or 0.0
        if waited > 0.0:
            sleep(waited)
        return waited

    def reset(self) -> None:
        """Forget every booking. For tests; a live process never goes back."""
        with self._lock:
            self._next_send_at = None

    def _interval_seconds(self) -> float:
        requests_per_minute = settings.llm_max_requests_per_minute
        if requests_per_minute <= 0:
            return 0.0
        return 60.0 / requests_per_minute


provider_rate_limiter = ProviderRateLimiter()
