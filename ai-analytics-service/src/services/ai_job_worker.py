import asyncio
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlsplit

import httpx

from src.application.ports import AnalysisRunner, JobStore
from src.config import settings
from src.services.analytics_runner import analytics_runner_service

logger = logging.getLogger(__name__)


def core_job_api_base(callback_base: str) -> str:
    """Derive the worker API from the same trusted Core origin as callbacks."""
    parsed = urlsplit(callback_base)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("DATA_LAYER_CALLBACK_URL must be a valid http(s) URL")
    netloc = parsed.hostname
    if parsed.port:
        netloc = f"{netloc}:{parsed.port}"
    return f"{parsed.scheme}://{netloc}/api/ai-analysis-runs"


@dataclass(frozen=True)
class JobLease:
    run_id: str
    round_id: str
    lease_token: str
    attempt_count: int


class LeaseLostError(RuntimeError):
    pass


class CoreJobClient:
    def __init__(
        self,
        *,
        callback_base: str,
        callback_secret: str,
        protection_bypass: str = "",
        timeout_seconds: float = 10.0,
    ):
        self.base_url = core_job_api_base(callback_base)
        self.callback_secret = callback_secret
        self.protection_bypass = protection_bypass
        self.timeout_seconds = timeout_seconds

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.callback_secret:
            headers["Authorization"] = f"Bearer {self.callback_secret}"
        if self.protection_bypass:
            headers["x-vercel-protection-bypass"] = self.protection_bypass
        return headers

    async def claim(self, worker_id: str) -> Optional[JobLease]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url}/claim/",
                headers=self._headers(),
                json={"workerId": worker_id},
            )
        if response.status_code in {204, 404}:
            # 404 is the consumer-first deployment window: an updated worker
            # may run briefly against a Core that does not expose jobs yet.
            return None
        response.raise_for_status()
        payload = response.json()
        run = payload["run"]
        return JobLease(
            run_id=run["id"],
            round_id=run["roundId"],
            lease_token=payload["leaseToken"],
            attempt_count=int(run["attemptCount"]),
        )

    async def heartbeat(self, run_id: str, lease_token: str) -> bool:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url}/{run_id}/heartbeat/",
                headers=self._headers(),
                json={"leaseToken": lease_token},
            )
        if response.status_code in {404, 409}:
            return False
        response.raise_for_status()
        return True

    async def fail(
        self,
        run_id: str,
        lease_token: str,
        failure_code: str,
    ) -> bool:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url}/{run_id}/fail/",
                headers=self._headers(),
                json={
                    "leaseToken": lease_token,
                    "failureCode": failure_code,
                },
            )
        if response.status_code in {404, 409}:
            return False
        response.raise_for_status()
        return True


class AiAnalysisJobWorker:
    def __init__(
        self,
        *,
        client: JobStore,
        runner: AnalysisRunner,
        worker_id: str,
        heartbeat_interval_seconds: float,
    ):
        self.client = client
        self.runner = runner
        self.worker_id = worker_id
        self.heartbeat_interval_seconds = heartbeat_interval_seconds

    async def _run_with_heartbeat(self, lease: JobLease) -> None:
        analysis = asyncio.create_task(
            self.runner.process_round(
                round_id=lease.round_id,
                run_id=lease.run_id,
                lease_token=lease.lease_token,
            )
        )
        try:
            while True:
                done, _ = await asyncio.wait(
                    {analysis},
                    timeout=self.heartbeat_interval_seconds,
                )
                if analysis in done:
                    await analysis
                    return
                renewed = await self.client.heartbeat(
                    lease.run_id,
                    lease.lease_token,
                )
                if not renewed:
                    raise LeaseLostError(
                        f"Lease lost for analysis run {lease.run_id}"
                    )
        finally:
            if not analysis.done():
                analysis.cancel()
                await asyncio.gather(analysis, return_exceptions=True)

    async def process_once(self) -> bool:
        lease = await self.client.claim(self.worker_id)
        if lease is None:
            return False

        logger.info(
            "[AI Job Worker] Claimed runId=%s attempt=%s",
            lease.run_id,
            lease.attempt_count,
        )
        try:
            await self._run_with_heartbeat(lease)
        except LeaseLostError:
            logger.warning(
                "[AI Job Worker] Lease lost for runId=%s; stopping stale work",
                lease.run_id,
            )
        except Exception:
            logger.exception(
                "[AI Job Worker] Analysis failed for runId=%s",
                lease.run_id,
            )
            try:
                await self.client.fail(
                    lease.run_id,
                    lease.lease_token,
                    "worker_error",
                )
            except Exception:
                logger.exception(
                    "[AI Job Worker] Could not persist failure for runId=%s",
                    lease.run_id,
                )
        return True

    async def run_forever(
        self,
        stop_event: asyncio.Event,
        poll_interval_seconds: float,
    ) -> None:
        while not stop_event.is_set():
            try:
                processed = await self.process_once()
            except Exception:
                logger.exception("[AI Job Worker] Poll failed")
                processed = False
            if not processed:
                try:
                    await asyncio.wait_for(
                        stop_event.wait(),
                        timeout=poll_interval_seconds,
                    )
                except asyncio.TimeoutError:
                    pass


def create_ai_analysis_job_worker(
    *,
    client: Optional[JobStore] = None,
    runner: Optional[AnalysisRunner] = None,
) -> AiAnalysisJobWorker:
    """Compose the worker from configuration, or from what a caller supplies."""
    worker_id = os.getenv("AI_JOB_WORKER_ID") or f"worker-{uuid.uuid4()}"
    return AiAnalysisJobWorker(
        client=client
        or CoreJobClient(
            callback_base=settings.data_layer_callback_url,
            callback_secret=settings.ai_callback_secret,
            protection_bypass=settings.vercel_protection_bypass,
        ),
        runner=runner or analytics_runner_service,
        worker_id=worker_id,
        heartbeat_interval_seconds=settings.ai_job_heartbeat_interval_seconds,
    )
