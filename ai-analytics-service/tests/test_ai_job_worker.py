import asyncio
import re
from unittest.mock import AsyncMock

import pytest

from src.services.ai_job_worker import (
    AiAnalysisJobWorker,
    JobLease,
    LeaseLostError,
    core_job_api_base,
    worker_id_for_slot,
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
