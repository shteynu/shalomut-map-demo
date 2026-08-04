"""What happens to a finished Stone Map between the graph and Core.

The payload behind one delivery cost roughly two dozen provider calls, so the
question these tests ask is narrow: which failures are worth another attempt,
which are a verdict on the payload itself, and does every attempt send the same
bytes under the same run identity so Core can recognise a repeat.
"""

import io
import json
import urllib.error
import urllib.request

import pytest

from src.config import settings
from src.services.result_sink import (
    CALLBACK_MAX_ATTEMPTS,
    CallbackDeliveryError,
    HttpResultSink,
)

ROUND_ID = "round-delivery-1"
CALLBACK_BASE = "https://data-layer.example/api/rounds"
PAYLOAD = {
    "contractVersion": "6.0",
    "roundId": ROUND_ID,
    "status": "success",
}


@pytest.fixture(autouse=True)
def data_layer_origin():
    previous = settings.data_layer_callback_url
    settings.data_layer_callback_url = CALLBACK_BASE
    try:
        yield
    finally:
        settings.data_layer_callback_url = previous


def http_error(status: int, headers: dict[str, str] | None = None):
    return urllib.error.HTTPError(
        url=f"{CALLBACK_BASE}/{ROUND_ID}/ai-insights/",
        code=status,
        msg="from the test",
        hdrs=headers or {},
        fp=io.BytesIO(b""),
    )


class RecordingSink(HttpResultSink):
    """A sink whose transport is scripted and whose waits are recorded.

    Only the one blocking HTTP call is replaced, so the real header policy,
    origin check and failure classification all run — the request each attempt
    would have put on the wire is what gets recorded.

    Jitter is pinned to zero so a delay can be asserted exactly. What jitter
    does — spread simultaneous retries — is not what these tests are about.
    """

    def __init__(self, outcomes):
        self.delays: list[float] = []
        super().__init__(sleep=self._record, jitter=lambda: 0.0)
        self.outcomes = list(outcomes)
        self.attempts: list[urllib.request.Request] = []

    async def _record(self, delay):
        self.delays.append(delay)

    def _post_callback(self, req):
        self.attempts.append(req)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return 200

    def headers_of(self, attempt: int) -> dict[str, str]:
        return {
            name.lower(): value
            for name, value in self.attempts[attempt].headers.items()
        }


async def deliver(sink):
    await sink.deliver(
        ROUND_ID,
        PAYLOAD,
        run_id="run-1",
        lease_token="lease-secret",
    )


@pytest.mark.asyncio
async def test_a_dropped_connection_is_tried_again():
    # The case retrying exists for: Core may have persisted the result and
    # lost only the answer on the way back.
    sink = RecordingSink([OSError("connection reset"), None])

    await deliver(sink)

    assert len(sink.attempts) == 2
    assert sink.delays == [1.0]


@pytest.mark.asyncio
async def test_every_attempt_repeats_the_same_bytes_and_run_identity():
    # This is what makes the retry safe rather than a second write: Core
    # recognises the repeat by the run it belongs to and the result it holds.
    sink = RecordingSink([OSError("reset"), OSError("reset"), None])

    await deliver(sink)

    assert len(sink.attempts) == 3
    assert all(
        request.data == sink.attempts[0].data for request in sink.attempts
    )
    assert json.loads(sink.attempts[0].data) == PAYLOAD
    assert all(
        request.full_url == f"{CALLBACK_BASE}/{ROUND_ID}/ai-insights/"
        for request in sink.attempts
    )
    for attempt in range(3):
        headers = sink.headers_of(attempt)
        assert headers["x-ai-analysis-run-id"] == "run-1"
        assert headers["x-ai-analysis-lease-token"] == "lease-secret"
    # The lease token is a capability and stays out of the URL on every retry.
    assert all("?" not in request.full_url for request in sink.attempts)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status",
    [400, 401, 404, 409],
    ids=["rejected payload", "unauthorized", "unknown run", "stale lease"],
)
async def test_a_verdict_on_the_payload_is_not_retried(status):
    sink = RecordingSink([http_error(status)])

    with pytest.raises(CallbackDeliveryError) as raised:
        await deliver(sink)

    assert raised.value.status == status
    assert raised.value.transient is False
    assert len(sink.attempts) == 1
    assert sink.delays == []


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [408, 429, 500, 502, 503])
async def test_an_answer_that_judges_nothing_is_retried_to_the_cap(status):
    sink = RecordingSink([http_error(status)] * CALLBACK_MAX_ATTEMPTS)

    with pytest.raises(CallbackDeliveryError) as raised:
        await deliver(sink)

    assert raised.value.transient is True
    assert len(sink.attempts) == CALLBACK_MAX_ATTEMPTS
    # One wait fewer than attempts: the last failure is reported, not slept on.
    assert len(sink.delays) == CALLBACK_MAX_ATTEMPTS - 1


@pytest.mark.asyncio
async def test_backoff_grows_between_attempts():
    sink = RecordingSink([OSError("reset")] * CALLBACK_MAX_ATTEMPTS)

    with pytest.raises(CallbackDeliveryError):
        await deliver(sink)

    assert sink.delays == [1.0, 2.0, 4.0]


@pytest.mark.asyncio
async def test_a_wait_core_asked_for_is_taken_as_given():
    sink = RecordingSink(
        [http_error(429, {"Retry-After": "12"}), None],
    )

    await deliver(sink)

    # Not shortened to the exponential schedule: 12 is what was asked for.
    assert sink.delays == [12.0]


@pytest.mark.asyncio
async def test_an_unreadable_retry_after_falls_back_to_the_schedule():
    sink = RecordingSink(
        [http_error(503, {"Retry-After": "soon"}), None],
    )

    await deliver(sink)

    assert sink.delays == [1.0]


@pytest.mark.asyncio
async def test_a_callback_outside_the_configured_origin_is_never_sent():
    # Not a delivery failure to be retried — a refusal to send at all.
    sink = HttpResultSink(sleep=None, jitter=lambda: 0.0)

    with pytest.raises(CallbackDeliveryError) as raised:
        await sink.post("https://elsewhere.example/api/rounds/r/ai-insights/", {})

    assert raised.value.transient is False


@pytest.mark.asyncio
async def test_a_redirect_is_a_wrong_address_not_bad_luck():
    # `urlopen` raises on 4xx and 5xx, so a non-2xx that reaches the status
    # check is a redirect that was not followed: the callback address is wrong.
    sink = RecordingSink(
        [
            CallbackDeliveryError(
                "Callback returned HTTP 302",
                transient=False,
                status=302,
            )
        ]
    )

    with pytest.raises(CallbackDeliveryError) as raised:
        await deliver(sink)

    assert raised.value.status == 302
    assert len(sink.attempts) == 1
    assert sink.delays == []
