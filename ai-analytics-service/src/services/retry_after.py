"""Reading the `Retry-After` header, for whoever is waiting on one.

Two transports need this now — the provider calls in `llm_transport` and the
result callback in `result_sink` — and neither should have to import the other
to get it. The rule both follow is the same: a wait the other side asked for is
not ours to shorten, and what bounds it is the caller's attempt cap.
"""

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


def parse_retry_after(value: str | None) -> float | None:
    """Seconds to wait, from either header form, or `None` if unreadable.

    The header is delta-seconds or an HTTP date. A malformed value is not an
    instruction, so it is ignored rather than guessed at.
    """
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            retry_at = parsedate_to_datetime(value)
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            return max(
                0.0,
                (retry_at - datetime.now(timezone.utc)).total_seconds(),
            )
        except (TypeError, ValueError, OverflowError):
            return None
