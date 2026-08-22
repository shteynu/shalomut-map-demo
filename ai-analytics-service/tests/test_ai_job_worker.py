import asyncio
import re
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
import pytest

from src.config import Settings, settings
from src.services.ai_job_worker import (
    CORE_LEASE_SECONDS,
    AiAnalysisJobWorker,
    JobLease,
    LeaseLostError,
    core_job_api_base,
    worker_id_for_slot,
)
from src.services.result_sink import CallbackDeliveryError

# Core's own copy of the lease. Present when the service is checked out inside
# the monorepo, absent when it is deployed on its own.
CORE_WORKER_MODULE = (
    Path(__file__).resolve().parents[2]
    / "src"
    / "lib"
    / "server"
    / "ai-analysis-worker.ts"
)


def worker_under_test(client, runner, **overrides):
    """A worker whose waits are short enough to watch in a test.

    The intervals are the only thing scaled down: a real one beats every 30
    seconds against a 90-second lease, and every test here is about what
    happens between two beats.
    """
    return AiAnalysisJobWorker(
        client=client,
        runner=runner,
        worker_id="worker-1",
        **{
            "heartbeat_interval_seconds": 0.01,
            "heartbeat_retry_delay_seconds": 0.0,
            "lease_seconds": 0.2,
            **overrides,
        },
    )


def test_core_job_api_is_derived_from_the_trusted_callback_origin():
    assert (
        core_job_api_base(
            "https://core.example/api/rounds",
        )
        == "https://core.example/api/ai-analysis-runs"
    )
    with pytest.raises(ValueError):
        core_job_api_base("javascript:alert(1)")


@pytest.mark.asyncio
async def test_worker_claims_and_processes_one_run_with_its_lease_identity():
    lease = JobLease(
        run_id="run-1",
        round_id="round-1",
        lease_token="lease-token-123456",
        attempt_count=1,
    )
    client = AsyncMock()
    client.claim.return_value = lease
    runner = AsyncMock()
    runner.process_round.return_value = {"status": "success"}
    worker = AiAnalysisJobWorker(
        client=client,
        runner=runner,
        worker_id="worker-1",
        heartbeat_interval_seconds=60,
    )

    assert await worker.process_once() is True

    client.claim.assert_awaited_once_with("worker-1")
    runner.process_round.assert_awaited_once_with(
        round_id="round-1",
        run_id="run-1",
        lease_token="lease-token-123456",
        # An ordinary run names no dimensions and carries no previous map,
        # which is what every run looked like before partial runs existed.
        regenerate_dimension_ids=(),
        previous_result=None,
    )
    client.fail.assert_not_awaited()


@pytest.mark.asyncio
async def test_worker_reports_an_unhandled_failure_but_not_a_lost_lease():
    lease = JobLease(
        run_id="run-2",
        round_id="round-2",
        lease_token="lease-token-654321",
        attempt_count=1,
    )
    client = AsyncMock()
    client.claim.return_value = lease
    runner = AsyncMock()
    runner.process_round.side_effect = RuntimeError("provider exploded")
    worker = AiAnalysisJobWorker(
        client=client,
        runner=runner,
        worker_id="worker-1",
        heartbeat_interval_seconds=60,
    )

    assert await worker.process_once() is True
    client.fail.assert_awaited_once_with(
        "run-2",
        "lease-token-654321",
        "worker_error",
    )

    client.reset_mock()
    client.claim.return_value = lease
    runner.process_round.side_effect = LeaseLostError("lease replaced")
    assert await worker.process_once() is True
    client.fail.assert_not_awaited()


def test_pool_slots_are_named_apart_and_fit_core_s_worker_id_rule():
    """A slot has to be identifiable, and Core has to accept the name.

    `ai_analysis_runs.worker_id` answers "who holds this run". A pool sharing
    one name cannot answer it, and a name Core refuses fails the claim outright
    — `isValidWorkerId` allows 1..120 of `[a-zA-Z0-9._:-]`.
    """
    assert worker_id_for_slot("worker-abc", None) == "worker-abc"
    assert worker_id_for_slot("worker-abc", 1) == "worker-abc:1"
    assert worker_id_for_slot("worker-abc", 2) == "worker-abc:2"

    long_base = "w" * 200
    named = worker_id_for_slot(long_base, 10)
    assert len(named) == 120
    assert named.endswith(":10")
    assert re.fullmatch(r"[a-zA-Z0-9._:-]{1,120}", named)


async def test_pool_slots_hold_their_own_leases_at_the_same_time():
    """The whole point: two rounds in flight at once, in one process.

    Written against the worker rather than the graph because the sequencing is
    the worker's: `run_forever` awaits `process_once`, so a single loop can only
    ever hold one lease. This proves a second loop claims while the first is
    still analysing, which is what turns a queue of fifty into five lanes.
    """
    started = asyncio.Event()
    release = asyncio.Event()
    in_flight = 0
    peak_in_flight = 0

    leases = [
        JobLease(
            run_id=f"run-{index}",
            round_id=f"round-{index}",
            lease_token=f"lease-token-{index:016d}",
            attempt_count=1,
        )
        for index in range(2)
    ]
    handed_out = iter(leases)

    async def claim(_worker_id):
        return next(handed_out, None)

    async def process_round(**_kwargs):
        nonlocal in_flight, peak_in_flight
        in_flight += 1
        peak_in_flight = max(peak_in_flight, in_flight)
        started.set()
        await release.wait()
        in_flight -= 1
        return {"status": "success"}

    client = AsyncMock()
    client.claim.side_effect = claim
    runner = AsyncMock()
    runner.process_round.side_effect = process_round

    workers = [
        AiAnalysisJobWorker(
            client=client,
            runner=runner,
            worker_id=worker_id_for_slot("worker-pool", slot + 1),
            heartbeat_interval_seconds=60,
        )
        for slot in range(2)
    ]

    running = [asyncio.create_task(worker.process_once()) for worker in workers]
    await asyncio.wait_for(started.wait(), timeout=2)
    # Both slots must be inside `process_round` before either is allowed to
    # finish; releasing first would let a sequential pair pass this test.
    await asyncio.sleep(0)
    release.set()
    assert all(await asyncio.gather(*running))

    assert peak_in_flight == 2
    assert {call.kwargs["run_id"] for call in runner.process_round.await_args_list} == {
        "run-0",
        "run-1",
    }


async def test_stopping_the_pool_cancels_every_slot():
    """Shutdown collects all slots, not just the first.

    A pool whose stop path awaited one task would leave the rest running into a
    closing event loop, and the lease they hold would have to expire on Core's
    side instead of being dropped cleanly.
    """
    client = AsyncMock()
    client.claim.return_value = None
    runner = AsyncMock()
    stop_event = asyncio.Event()

    workers = [
        AiAnalysisJobWorker(
            client=client,
            runner=runner,
            worker_id=worker_id_for_slot("worker-pool", slot + 1),
            heartbeat_interval_seconds=60,
        )
        for slot in range(3)
    ]
    tasks = [
        asyncio.create_task(worker.run_forever(stop_event, 0.01))
        for worker in workers
    ]

    await asyncio.sleep(0.05)
    assert all(not task.done() for task in tasks)

    stop_event.set()
    await asyncio.wait_for(asyncio.gather(*tasks), timeout=2)
    assert all(task.done() and not task.cancelled() for task in tasks)


@pytest.mark.asyncio
async def test_a_partial_run_carries_its_dimensions_and_the_map_it_amends():
    """The worker is a courier here, and that is the whole of its job.

    What to write again is Core's decision and how to write it is the graph's;
    the worker must not improve on either, so this asserts that both arrive
    from the lease and reach the runner unchanged.
    """
    previous = {"stones": {"balance": {"summary": ["פסקה"]}}}
    lease = JobLease(
        run_id="run-partial",
        round_id="round-partial",
        lease_token="lease-token-partial",
        attempt_count=0,
        regenerate_dimension_ids=("balance", "certainty"),
        previous_result=previous,
    )
    client = AsyncMock()
    client.claim.return_value = lease
    runner = AsyncMock()
    runner.process_round.return_value = {"status": "success"}
    worker = AiAnalysisJobWorker(
        client=client,
        runner=runner,
        worker_id="worker-1",
        heartbeat_interval_seconds=60,
    )

    assert await worker.process_once() is True

    runner.process_round.assert_awaited_once_with(
        round_id="round-partial",
        run_id="run-partial",
        lease_token="lease-token-partial",
        regenerate_dimension_ids=("balance", "certainty"),
        previous_result=previous,
    )


async def test_an_idle_worker_widens_its_wait_up_to_the_ceiling(monkeypatch):
    """The queue is empty almost always, and every ask costs Core a request.

    Core answers a claim with two queries and a `204`, on a serverless
    invocation, once per slot. At a flat two seconds that is some 43 000 a day
    to learn nothing. Doubling the wait after each empty answer brings it near
    2 900 without changing what a busy worker does, so what this pins down is
    the sequence: one base interval first, then out to the ceiling and no
    further.
    """
    waits: list[float] = []
    stop_event = asyncio.Event()

    async def record(event, timeout):
        waits.append(timeout)
        if len(waits) == 5:
            event.set()

    monkeypatch.setattr("src.services.ai_job_worker.wait_between_polls", record)

    client = AsyncMock()
    client.claim.return_value = None
    worker = AiAnalysisJobWorker(
        client=client,
        runner=AsyncMock(),
        worker_id="worker-idle",
        heartbeat_interval_seconds=60,
    )

    await asyncio.wait_for(
        worker.run_forever(stop_event, 2.0, 30.0),
        timeout=2,
    )

    assert waits == [2.0, 4.0, 8.0, 16.0, 30.0]


async def test_claimed_work_snaps_the_wait_back_to_the_base_interval(
    monkeypatch,
):
    """A queue that just had work is the one most likely to have more.

    Fifty schools closing together arrive as a queue, not as one job, so a
    worker that stayed at its idle ceiling after finishing would leave the rest
    of them waiting half a minute apiece. The reset is what keeps the backoff a
    property of silence rather than of the queue's length.
    """
    waits: list[float] = []
    stop_event = asyncio.Event()

    async def record(event, timeout):
        waits.append(timeout)
        if len(waits) == 4:
            event.set()

    monkeypatch.setattr("src.services.ai_job_worker.wait_between_polls", record)

    lease = JobLease(
        run_id="run-idle-then-busy",
        round_id="round-idle-then-busy",
        lease_token="lease-token-987654",
        attempt_count=1,
    )
    answers = iter([None, None, lease])

    async def claim(_worker_id):
        return next(answers, None)

    client = AsyncMock()
    client.claim.side_effect = claim
    runner = AsyncMock()
    runner.process_round.return_value = {"status": "success"}
    worker = AiAnalysisJobWorker(
        client=client,
        runner=runner,
        worker_id="worker-idle-then-busy",
        heartbeat_interval_seconds=60,
    )

    await asyncio.wait_for(
        worker.run_forever(stop_event, 2.0, 30.0),
        timeout=2,
    )

    # Two empty polls widen the wait, the claimed run resets it, and the two
    # empty polls after it start over from the base rather than from 8.
    assert waits == [2.0, 4.0, 2.0, 4.0]


async def test_a_worker_without_a_ceiling_keeps_the_flat_cadence(monkeypatch):
    """Backoff is opt-in at the call site, so a caller that never heard of it
    polls exactly as it did before."""
    waits: list[float] = []
    stop_event = asyncio.Event()

    async def record(event, timeout):
        waits.append(timeout)
        if len(waits) == 3:
            event.set()

    monkeypatch.setattr("src.services.ai_job_worker.wait_between_polls", record)

    client = AsyncMock()
    client.claim.return_value = None
    worker = AiAnalysisJobWorker(
        client=client,
        runner=AsyncMock(),
        worker_id="worker-flat",
        heartbeat_interval_seconds=60,
    )

    await asyncio.wait_for(worker.run_forever(stop_event, 2.0), timeout=2)

    assert waits == [2.0, 2.0, 2.0]


def test_the_idle_ceiling_can_never_sit_below_the_poll_interval(monkeypatch):
    """A ceiling under the base would read as a shorter interval, not a longer
    one, and would speed the polling up in the name of slowing it down."""
    monkeypatch.setenv("AI_JOB_POLL_INTERVAL_SECONDS", "5")
    monkeypatch.setenv("AI_JOB_POLL_MAX_INTERVAL_SECONDS", "1")
    assert Settings().ai_job_poll_max_interval_seconds == 5.0

    monkeypatch.setenv("AI_JOB_POLL_MAX_INTERVAL_SECONDS", "45")
    assert Settings().ai_job_poll_max_interval_seconds == 45.0

    monkeypatch.delenv("AI_JOB_POLL_MAX_INTERVAL_SECONDS")
    assert Settings().ai_job_poll_max_interval_seconds == 30.0


@pytest.mark.asyncio
async def test_a_heartbeat_that_could_not_be_sent_is_tried_again():
    """One blip must not cost a three-minute paid analysis.

    Core serves claims, heartbeats, callbacks and manager screens from the same
    deployment: on a busy day of closings a renewal meets a 502 or takes longer
    than the ten-second timeout. That said nothing about this run — and before
    this, it ended it, cancelling the analysis and burning up to 28 provider
    calls that had already been paid for.
    """
    beats = []
    renewed = asyncio.Event()
    completed = False

    async def heartbeat(_run_id, _lease_token):
        beats.append(len(beats) + 1)
        if len(beats) == 1:
            raise httpx.ConnectTimeout("Core did not answer in time")
        renewed.set()
        return True

    async def process_round(**_kwargs):
        nonlocal completed
        await renewed.wait()
        completed = True
        return {"status": "success"}

    client = AsyncMock()
    client.claim.return_value = JobLease(
        run_id="run-blip",
        round_id="round-blip",
        lease_token="lease-token-blip",
        attempt_count=1,
    )
    client.heartbeat.side_effect = heartbeat
    runner = AsyncMock()
    runner.process_round.side_effect = process_round

    assert await worker_under_test(client, runner).process_once() is True

    assert len(beats) == 2, "the failed renewal was not tried again"
    assert completed, "the analysis was cancelled over a renewal that failed"
    client.fail.assert_not_awaited()


@pytest.mark.asyncio
async def test_one_renewal_is_three_tries_before_it_reports_silence():
    """The retry has to happen inside the renewal, not on the next beat.

    A worker that took one try per beat would get three chances in a lease and
    spend a full interval waiting between them. Asserted on `_renew_lease`
    itself because through the loop the two are indistinguishable — the next
    beat also sends a heartbeat, and a test that only counted them would pass
    with the retrying removed.
    """
    lease = JobLease(
        run_id="run-renew",
        round_id="round-renew",
        lease_token="lease-token-renew",
        attempt_count=1,
    )
    answers = [
        httpx.ConnectTimeout("first"),
        httpx.ConnectTimeout("second"),
        True,
    ]

    async def heartbeat(_run_id, _lease_token):
        answer = answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    client = AsyncMock()
    client.heartbeat.side_effect = heartbeat
    worker = worker_under_test(client, AsyncMock())

    assert await worker._renew_lease(lease) is True
    assert client.heartbeat.await_count == 3

    client.reset_mock()
    client.heartbeat.side_effect = httpx.ConnectError("Core is unreachable")
    assert await worker._renew_lease(lease) is False
    assert client.heartbeat.await_count == worker.heartbeat_attempts


@pytest.mark.asyncio
async def test_a_lease_core_says_is_gone_is_not_argued_with():
    """A refusal is a verdict, and repeating the question repeats the verdict.

    Core answers 404 or 409 when the run is gone or the lease has been handed
    to somebody else. Retrying that would keep a stale analysis running against
    a round another worker is already redoing.
    """
    client = AsyncMock()
    client.claim.return_value = JobLease(
        run_id="run-lost",
        round_id="round-lost",
        lease_token="lease-token-lost",
        attempt_count=1,
    )
    client.heartbeat.return_value = False

    async def process_round(**_kwargs):
        await asyncio.Event().wait()

    runner = AsyncMock()
    runner.process_round.side_effect = process_round

    assert await worker_under_test(client, runner).process_once() is True

    assert client.heartbeat.await_count == 1
    client.fail.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_lease_that_can_never_be_renewed_is_released_not_failed():
    """Core unreachable for the whole lease still leaves the run its attempts.

    `fail()` is terminal: `claimNext` never picks the run up again, nobody is
    notified and the school's map simply never arrives. Silence from Core is
    not a verdict on the analysis, so the lease is left to expire — expiry plus
    reclaim is exactly the mechanism that gives a run its remaining attempts.
    """
    cancelled = False

    async def process_round(**_kwargs):
        nonlocal cancelled
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled = True
            raise

    client = AsyncMock()
    client.claim.return_value = JobLease(
        run_id="run-unreachable",
        round_id="round-unreachable",
        lease_token="lease-token-unreachable",
        attempt_count=1,
    )
    client.heartbeat.side_effect = httpx.ConnectError("Core is unreachable")
    runner = AsyncMock()
    runner.process_round.side_effect = process_round

    worker = worker_under_test(client, runner, lease_seconds=0.05)
    assert await asyncio.wait_for(worker.process_once(), timeout=2) is True

    # More than one whole renewal — the lease outlives the beat several times
    # over, and a worker that released at the first silent renewal would throw
    # the analysis away with most of its lease still unspent.
    assert client.heartbeat.await_count > worker.heartbeat_attempts
    assert cancelled, "stale work kept running after the lease was released"
    client.fail.assert_not_awaited()


@pytest.mark.asyncio
async def test_an_undelivered_result_is_released_for_another_attempt():
    """The map exists; only the road to Core was out.

    `HttpResultSink` already retries a transient callback four times, and what
    escapes it is a Core that stayed unreachable throughout. Failing the run
    then throws away a finished analysis over the last hop — and the retry
    re-sends the same bytes under the same run identity, which Core recognises
    as the result it may already hold.
    """
    client = AsyncMock()
    client.claim.return_value = JobLease(
        run_id="run-undelivered",
        round_id="round-undelivered",
        lease_token="lease-token-undelivered",
        attempt_count=1,
    )
    runner = AsyncMock()
    runner.process_round.side_effect = CallbackDeliveryError(
        "Callback undelivered after 4 attempts",
        transient=True,
        status=503,
    )

    assert await worker_under_test(client, runner).process_once() is True

    client.fail.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_refused_payload_still_fails_the_run_once():
    """Retrying a verdict spends the money again to hear it again.

    Core answers 400 to a payload it will not accept and 409 to a stale lease.
    Neither changes on a second attempt, so the run is failed once — which is
    also what keeps the release path above from becoming "retry everything".
    """
    client = AsyncMock()
    client.claim.return_value = JobLease(
        run_id="run-refused",
        round_id="round-refused",
        lease_token="lease-token-refused",
        attempt_count=1,
    )
    runner = AsyncMock()
    runner.process_round.side_effect = CallbackDeliveryError(
        "Callback refused",
        transient=False,
        status=400,
    )

    assert await worker_under_test(client, runner).process_once() is True

    client.fail.assert_awaited_once_with(
        "run-refused",
        "lease-token-refused",
        "worker_error",
    )


def test_the_lease_this_worker_measures_is_the_lease_core_grants():
    """A mirrored constant that drifts is worse than no constant at all.

    The worker decides when to stop analysing by how long it has gone without
    renewing. If Core shortened its lease and this number stayed at ninety, the
    worker would keep spending provider calls on a round another worker had
    already reclaimed — and both would deliver a map for it.
    """
    if not CORE_WORKER_MODULE.exists():
        pytest.skip("Core is not checked out beside the service")

    granted = re.search(
        r"AI_ANALYSIS_JOB_LEASE_MS\s*=\s*([\d_]+)",
        CORE_WORKER_MODULE.read_text(encoding="utf-8"),
    )
    assert granted, "Core no longer declares AI_ANALYSIS_JOB_LEASE_MS"
    assert float(granted.group(1).replace("_", "")) / 1000 == CORE_LEASE_SECONDS


def test_the_heartbeat_cadence_leaves_room_for_a_missed_renewal():
    """`config.py` says the 30s/90s pair "leaves a full retry window". This is
    that claim, asserted: a lease has to outlast at least two beats, or a
    single missed renewal would end the run whatever the retrying did."""
    assert settings.ai_job_heartbeat_interval_seconds * 2 <= CORE_LEASE_SECONDS
