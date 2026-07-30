from unittest.mock import AsyncMock

import pytest

from src.services.ai_job_worker import (
    AiAnalysisJobWorker,
    JobLease,
    LeaseLostError,
    core_job_api_base,
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
