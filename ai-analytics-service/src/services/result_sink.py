"""Delivery of a finished Stone Map to the Data Layer.

Lifted out of `AnalyticsRunnerService`, which had the HTTP call, the header
policy and the URL construction written into its own body. The run now knows
only that a payload belongs to a round; everything about how that reaches Core
lives here, behind the `ResultSink` port.

Two levels, deliberately: `post` is one HTTP attempt and `deliver` is the
promise the port makes — that a finished analysis reaches Core or says clearly
that it did not. The analysis behind one payload costs roughly two dozen
provider calls, so a lost TCP connection is not a reason to throw it away.
"""

import asyncio
import json
import logging
import random
import urllib.error
import urllib.request
from typing import Any, Awaitable, Callable, Dict, Optional
from urllib.parse import quote, urlsplit

from src.config import settings
from src.services.retry_after import parse_retry_after

logger = logging.getLogger(__name__)

CALLBACK_TIMEOUT_SECONDS = 5.0

# Four attempts spread over roughly seven seconds of backoff. The worker
# heartbeats every thirty seconds against a ninety-second lease and keeps
# beating while delivery runs, so this budget cannot outlive the lease it is
# delivering for.
CALLBACK_MAX_ATTEMPTS = 4
CALLBACK_BASE_DELAY_SECONDS = 1.0
CALLBACK_MAX_DELAY_SECONDS = 8.0
CALLBACK_JITTER_SECONDS = 0.5


class CallbackDeliveryError(RuntimeError):
    """A failed delivery attempt, and whether trying again could help.

    `transient` is the whole point. Core answers a rejected payload with `400`,
    a stale lease with `409` and an unknown run with `404`: those are verdicts
    about the analysis, and repeating the request repeats the verdict. A
    dropped connection, a timeout or a `503` says nothing about the payload,
    and in the worst case says only that an answer was lost on the way back
    from a Core that already persisted the result.
    """

    def __init__(
        self,
        message: str,
        *,
        transient: bool,
        status: Optional[int] = None,
        retry_after: Optional[float] = None,
    ):
        super().__init__(message)
        self.transient = transient
        self.status = status
        self.retry_after = retry_after


def _url_origin(url: str):
    try:
        parsed = urlsplit(url)
        scheme = parsed.scheme.lower()
        if scheme not in {"http", "https"} or not parsed.hostname:
            return None
        port = parsed.port or (443 if scheme == "https" else 80)
        return scheme, parsed.hostname.lower().rstrip("."), port
    except ValueError:
        return None


def _is_transient_status(status: int) -> bool:
    """`408`, `429` and every `5xx` may differ next time; other `4xx` will not.

    `503` is included even though Core returns it when the deployment has no
    database configured. That is not transient in the sense of a passing blip,
    but it is also not a judgement on this payload, and the attempt cap ends
    the retrying either way.
    """
    return status in {408, 425, 429} or 500 <= status <= 599


class HttpResultSink:
    """Posts the payload to the configured Data Layer callback endpoint."""

    def __init__(
        self,
        *,
        sleep: Optional[Callable[[float], Awaitable[None]]] = None,
        jitter: Optional[Callable[[], float]] = None,
    ):
        # Injected so a test can prove the retry sequence without waiting for
        # it, and read the delays it would have taken.
        self._sleep = sleep or asyncio.sleep
        self._jitter = jitter or (
            lambda: random.uniform(0.0, CALLBACK_JITTER_SECONDS)
        )

    def callback_url(self, round_id: str) -> str:
        """The endpoint one round's result belongs to.

        The round id is escaped: it reaches this service from a job record, and
        a round whose id contains a slash must not be able to aim the callback
        at a different path.
        """
        callback_base = settings.data_layer_callback_url.rstrip("/")
        return f"{callback_base}/{quote(round_id, safe='')}/ai-insights/"

    async def deliver(
        self,
        round_id: str,
        payload: Dict[str, Any],
        *,
        run_id: Optional[str] = None,
        lease_token: Optional[str] = None,
    ) -> None:
        """Get this result to Core, or say why it could not be.

        Every attempt sends the same bytes under the same run identity, which
        is what makes retrying safe: Core recognises the repeat as the result
        it already stored and answers success rather than storing it twice.
        """
        callback_url = self.callback_url(round_id)

        for attempt in range(1, CALLBACK_MAX_ATTEMPTS + 1):
            try:
                await self.post(
                    callback_url,
                    payload,
                    run_id=run_id,
                    lease_token=lease_token,
                )
            except CallbackDeliveryError as error:
                if not error.transient:
                    logger.error(
                        "[ResultSink] Callback refused for round %s on attempt "
                        "%s; not retried: %s",
                        round_id,
                        attempt,
                        error,
                    )
                    raise
                if attempt == CALLBACK_MAX_ATTEMPTS:
                    logger.error(
                        "[ResultSink] Callback for round %s undelivered after "
                        "%s attempts: %s",
                        round_id,
                        attempt,
                        error,
                    )
                    raise
                delay = self._retry_delay(attempt, error.retry_after)
                logger.warning(
                    "[ResultSink] Callback attempt %s of %s for round %s "
                    "failed (%s); retrying in %.2fs",
                    attempt,
                    CALLBACK_MAX_ATTEMPTS,
                    round_id,
                    error,
                    delay,
                )
                await self._sleep(delay)
                continue

            if attempt > 1:
                logger.info(
                    "[ResultSink] Callback for round %s acknowledged on "
                    "attempt %s of %s",
                    round_id,
                    attempt,
                    CALLBACK_MAX_ATTEMPTS,
                )
            return

    def _retry_delay(self, attempt: int, retry_after: Optional[float]) -> float:
        jitter = self._jitter()
        if retry_after is not None:
            # A wait Core asked for is not ours to shorten, the same rule the
            # provider transport follows. The attempt cap is what bounds it.
            return retry_after + jitter
        exponential = CALLBACK_BASE_DELAY_SECONDS * (2 ** (attempt - 1))
        return min(exponential + jitter, CALLBACK_MAX_DELAY_SECONDS)

    async def post(
        self,
        callback_url: str,
        payload: Dict[str, Any],
        *,
        run_id: Optional[str] = None,
        lease_token: Optional[str] = None,
    ) -> None:
        """One attempt at sending one payload to one URL inside Core's origin.

        Raises `CallbackDeliveryError` carrying whether a further attempt could
        change the answer. `deliver` is what decides to take one.
        """
        callback_origin = _url_origin(callback_url)
        data_layer_origin = _url_origin(settings.data_layer_callback_url)
        if (
            callback_origin is None
            or data_layer_origin is None
            or callback_origin != data_layer_origin
        ):
            raise CallbackDeliveryError(
                "Refusing callback outside the configured Data Layer origin",
                transient=False,
            )

        req_bytes = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if run_id and lease_token:
            # Lease tokens are capabilities. Headers keep them out of proxy
            # and platform access-log URLs.
            headers["X-AI-Analysis-Run-Id"] = run_id
            headers["X-AI-Analysis-Lease-Token"] = lease_token
        if settings.ai_callback_secret:
            headers["Authorization"] = f"Bearer {settings.ai_callback_secret}"
        if settings.vercel_protection_bypass:
            headers["x-vercel-protection-bypass"] = (
                settings.vercel_protection_bypass
            )

        logger.info("[ResultSink] Posting final Stone Map payload")
        req = urllib.request.Request(
            callback_url,
            data=req_bytes,
            headers=headers,
            method="POST",
        )

        try:
            status = await asyncio.to_thread(self._post_callback, req)
            logger.info("[ResultSink] Callback response status: %s", status)
        except urllib.error.HTTPError as error:
            # Read before the response closes; the body is Core's own reason.
            raise CallbackDeliveryError(
                f"Unable to deliver AI analytics callback: HTTP {error.code}",
                transient=_is_transient_status(error.code),
                status=error.code,
                retry_after=parse_retry_after(
                    error.headers.get("Retry-After") if error.headers else None
                ),
            ) from error
        except CallbackDeliveryError:
            raise
        except Exception as e:
            # A dropped connection or a timeout. Core may have persisted the
            # result and lost only the answer, so this is the case retrying
            # exists for.
            raise CallbackDeliveryError(
                f"Unable to deliver AI analytics callback: {e}",
                transient=True,
            ) from e

    @staticmethod
    def _post_callback(req: urllib.request.Request) -> int:
        """Blocking delivery, executed in a worker thread so the event loop
        stays responsive while the Data Layer persists the Stone Map.
        """
        with urllib.request.urlopen(
            req,
            timeout=CALLBACK_TIMEOUT_SECONDS,
        ) as response:
            if response.status < 200 or response.status >= 300:
                # `urlopen` raises on 4xx/5xx, so this is a redirect that was
                # not followed: the callback address is wrong, not unlucky.
                raise CallbackDeliveryError(
                    f"Callback returned HTTP {response.status}",
                    transient=False,
                    status=response.status,
                )
            return response.status
