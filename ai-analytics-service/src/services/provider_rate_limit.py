"""How often this process may reach the provider, and nothing more.

A free tier counts three separate things: requests in flight, requests per
minute and requests per day. `LLM_MAX_CONCURRENT_REQUESTS` answers only the
first one. Seventeen requests handed through two concurrent slots still arrive
inside a single minute, and five per minute is what Google's free tier allows
for `gemini-3.5-flash` (limits read 2026-07-29) — which is why every live round
so far died on `429` while the model itself was answering.

The queue is one per model per process. Per model, because that is the unit the
provider counts in: one number for the whole process was safe only while the
process used one model, and `retry_tier` moves a replay to the heavy model. Two
names, two buckets; the same name twice, one bucket.

Per process, because a process is all a lock can reach — and that used to be an
assumption rather than a fact. The quota is counted per key, so a second
process (a second Render instance, a `WEB_CONCURRENCY` above one, or the
overlap of an old and a new container during a deploy) kept a second private
queue and the two together sent at twice the configured pace against one
budget. Nothing caught it, and `429` is what the account sees.

So the pace is now a share rather than a whole: `set_sending_processes` divides
the interval by however many worker processes hold a live lease, which Core
reports on the claim and on every heartbeat. One process divides by one and
paces exactly as it always did. What the division buys is that a second process
becomes a scaling decision instead of a quota bug.

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
    """A booking queue per model for every request this process sends out."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._next_send_at: dict[str, float] = {}
        self._sending_processes: int = 1

    def set_sending_processes(self, count: int) -> None:
        """How many processes are spending this key's quota right now.

        Observed rather than configured: an environment variable naming the
        fleet size is one more number to keep true, and it cannot see the case
        that needs no configuration at all — a zero-downtime deploy, where an
        old container finishing a round overlaps a new one starting.

        Anything below one is read as one. A caller that has counted nobody has
        failed to count itself, and pacing against zero senders would mean
        pacing against no limit.

        Bookings already made are left where they are. The new share applies to
        the next turn taken, which is at most one interval away.
        """
        with self._lock:
            self._sending_processes = max(1, int(count))

    def book(
        self,
        *,
        model: str,
        min_delay: float = 0.0,
        max_wait: Optional[float] = None,
    ) -> Optional[float]:
        """Take the next turn and report how long the caller must wait for it.

        `model` is required rather than defaulted because a pace means nothing
        without the name it is counted against, and a default would silently
        charge one model's request to another model's budget.

        `min_delay` is a floor the caller brings along — a provider's own
        `Retry-After` outranks our interval when it asks for more than one, and
        never buys a send earlier than the pace allows when it asks for less.
        `max_wait` declines a turn the caller cannot afford, and the queue is
        left untouched then, so a caller that walks away costs nobody else
        their place.

        Returns the seconds to wait, or `None` when the turn was declined.
        """
        interval = self._interval_seconds(model)
        now = monotonic()
        with self._lock:
            booked = self._next_send_at.get(model)
            earliest = booked if booked is not None else now
            wait = max(0.0, earliest - now, min_delay)
            if max_wait is not None and wait > max_wait:
                return None
            self._next_send_at[model] = now + wait + interval
            return wait

    def wait(self, *, model: str, min_delay: float = 0.0) -> float:
        """Take the next turn and sleep until it. Returns the seconds slept."""
        # A turn is only ever declined against a `max_wait`, which this caller
        # does not bring: it waits however long the queue says.
        waited = self.book(model=model, min_delay=min_delay) or 0.0
        if waited > 0.0:
            sleep(waited)
        return waited

    def reset(self) -> None:
        """Forget every booking and every peer. For tests; a live process
        never goes back."""
        with self._lock:
            self._next_send_at.clear()
            self._sending_processes = 1

    def _interval_seconds(self, model: str) -> float:
        requests_per_minute = settings.requests_per_minute_for(model)
        if requests_per_minute <= 0:
            return 0.0
        # An unpaced tier stays unpaced above; everything else is divided by
        # the number of processes sending, which is the same arithmetic as
        # giving each of them `requests_per_minute / senders`. Written as a
        # multiplied interval because the interval is what a booking uses, and
        # dividing the rate first would round twice.
        with self._lock:
            senders = self._sending_processes
        return 60.0 * senders / requests_per_minute


provider_rate_limiter = ProviderRateLimiter()
