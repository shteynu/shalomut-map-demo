import asyncio
import logging
import os
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional
from urllib.parse import urlsplit

import httpx

from src.application.ports import AnalysisRunner, JobStore
from src.config import settings
from src.services.analytics_runner import analytics_runner_service
from src.services.result_sink import CallbackDeliveryError

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
    # What a partial run has to write again, and the map it amends. Both
    # default to the ordinary run — no dimensions named, no previous map — so a
    # Core that does not send them yet claims exactly the job it always did.
    regenerate_dimension_ids: tuple[str, ...] = ()
    previous_result: Optional[dict] = None


# Core leases a run for ninety seconds — `AI_ANALYSIS_JOB_LEASE_MS` in
# `src/lib/server/ai-analysis-worker.ts`. The worker needs the number to know
# when a renewal it could not make has actually cost it the lease, so the
# constant is mirrored here; `test_ai_job_worker.py` reads Core's file and
# fails if the two ever disagree.
CORE_LEASE_SECONDS = 90.0

# One renewal is three tries, spaced far enough apart that a passing blip is
# over before the last of them and close enough together that all three fit
# inside the heartbeat interval they belong to.
HEARTBEAT_ATTEMPTS = 3
HEARTBEAT_RETRY_DELAY_SECONDS = 2.0


class LeaseLostError(RuntimeError):
    """Core answered that this lease is not ours any more."""


class LeaseUnreachableError(LeaseLostError):
    """Core could not be asked, for longer than the lease can survive.

    A loss we assume rather than one we were told about, which is why it is a
    `LeaseLostError`: both mean stop working on this run, and neither means
    the run is finished. What it must never become is a `fail()` — the run is
    still eligible for its remaining attempts, and only its own expiry can
    hand it to the next worker.
    """


def is_worth_another_attempt(error: BaseException) -> bool:
    """Whether a failure says anything about the analysis itself.

    A delivery that ran out of attempts against a Core that was unreachable,
    timing out or answering `5xx` is a statement about the network, not about
    the map: the roughly two dozen provider calls behind that payload are
    already spent, and a reclaimed attempt re-sends the same bytes under the
    same run identity, which Core recognises as the result it already has.
    Everything else — a refused payload, a stale lease, a crash in our own
    code — repeats verdict for verdict, so it is failed once and left failed.
    """
    return isinstance(error, CallbackDeliveryError) and error.transient


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
            regenerate_dimension_ids=tuple(
                run.get("regenerateDimensionIds") or ()
            ),
            previous_result=payload.get("previousResult"),
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


async def wait_between_polls(stop_event: asyncio.Event, timeout: float) -> None:
    """Wait out one poll interval, or return early when the process stops.

    A function of its own so shutdown stays immediate however long the idle
    wait has grown — and so a test can watch the lengths without a clock.
    """
    try:
        await asyncio.wait_for(stop_event.wait(), timeout=timeout)
    except asyncio.TimeoutError:
        pass


class AiAnalysisJobWorker:
    def __init__(
        self,
        *,
        client: JobStore,
        runner: AnalysisRunner,
        worker_id: str,
        heartbeat_interval_seconds: float,
        lease_seconds: float = CORE_LEASE_SECONDS,
        heartbeat_attempts: int = HEARTBEAT_ATTEMPTS,
        heartbeat_retry_delay_seconds: float = HEARTBEAT_RETRY_DELAY_SECONDS,
    ):
        self.client = client
        self.runner = runner
        self.worker_id = worker_id
        self.heartbeat_interval_seconds = heartbeat_interval_seconds
        self.lease_seconds = lease_seconds
        self.heartbeat_attempts = heartbeat_attempts
        self.heartbeat_retry_delay_seconds = heartbeat_retry_delay_seconds

    async def _renew_lease(self, lease: JobLease) -> bool:
        """Ask Core to extend this lease, retrying a blip but not a refusal.

        Returns whether the lease was renewed, so a caller that could not ask
        can decide what the silence is worth. Raises `LeaseLostError` when
        Core answers that the lease is no longer ours: that answer is final,
        and asking again only takes longer to arrive at the same place.
        """
        for attempt in range(1, self.heartbeat_attempts + 1):
            try:
                renewed = await self.client.heartbeat(
                    lease.run_id,
                    lease.lease_token,
                )
            except Exception:
                # Every way of not getting an answer is one case: a timeout, a
                # 502 from a busy Core, a dropped connection. None of them says
                # the lease is gone, and none of them is worth throwing a
                # three-minute paid analysis away for.
                logger.warning(
                    "[AI Job Worker] Heartbeat attempt %s of %s did not reach "
                    "Core for runId=%s",
                    attempt,
                    self.heartbeat_attempts,
                    lease.run_id,
                    exc_info=True,
                )
            else:
                if renewed:
                    return True
                raise LeaseLostError(
                    f"Lease lost for analysis run {lease.run_id}"
                )
            if attempt < self.heartbeat_attempts:
                await asyncio.sleep(self.heartbeat_retry_delay_seconds)
        return False

    async def _run_with_heartbeat(self, lease: JobLease) -> None:
        analysis = asyncio.create_task(
            self.runner.process_round(
                round_id=lease.round_id,
                run_id=lease.run_id,
                lease_token=lease.lease_token,
                regenerate_dimension_ids=lease.regenerate_dimension_ids,
                previous_result=lease.previous_result,
            )
        )
        # Measured against the loop's own clock, which only moves forward and
        # is what `asyncio.wait` counts its timeout in.
        loop = asyncio.get_running_loop()
        renewed_at = loop.time()
        try:
            while True:
                done, _ = await asyncio.wait(
                    {analysis},
                    timeout=self.heartbeat_interval_seconds,
                )
                if analysis in done:
                    await analysis
                    return
                if await self._renew_lease(lease):
                    renewed_at = loop.time()
                    continue
                # Core could not be asked. The lease is what decides whether
                # that matters yet: it outlives the heartbeat interval several
                # times over precisely so a renewal can be missed, and until it
                # runs out this run is still ours and still being analysed.
                unrenewed_for = loop.time() - renewed_at
                if unrenewed_for >= self.lease_seconds:
                    raise LeaseUnreachableError(
                        f"Lease for analysis run {lease.run_id} went "
                        f"{unrenewed_for:.0f}s without a renewal"
                    )
                logger.warning(
                    "[AI Job Worker] Lease for runId=%s unrenewed for %.0fs of "
                    "%.0fs; the analysis continues",
                    lease.run_id,
                    unrenewed_for,
                    self.lease_seconds,
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
        except LeaseUnreachableError as error:
            # Deliberately not a `fail()`. The run keeps its remaining
            # attempts, its lease expires on its own, and `claimNext` hands it
            # to whichever worker asks next.
            logger.warning(
                "[AI Job Worker] Releasing runId=%s for a later attempt: %s",
                lease.run_id,
                error,
            )
        except LeaseLostError:
            logger.warning(
                "[AI Job Worker] Lease lost for runId=%s; stopping stale work",
                lease.run_id,
            )
        except Exception as error:
            if is_worth_another_attempt(error):
                logger.warning(
                    "[AI Job Worker] Analysis for runId=%s could not be "
                    "delivered (%s); releasing the lease rather than failing "
                    "the run",
                    lease.run_id,
                    error,
                )
                return True
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
        max_poll_interval_seconds: Optional[float] = None,
    ) -> None:
        """Claim work until told to stop, asking less often while idle.

        An empty queue is the ordinary state, and asking it every couple of
        seconds spends a Core invocation and two queries to be told `204`. So
        each empty answer doubles the next wait up to the ceiling, and a
        claimed job snaps it back to `poll_interval_seconds`. A failed poll
        widens it too, on purpose: a Core that cannot answer is the last thing
        to ask twice as often. Omitting the ceiling keeps the flat cadence this
        loop had before, which is what existing callers get.
        """
        ceiling = max(poll_interval_seconds, max_poll_interval_seconds or 0.0)
        interval = poll_interval_seconds
        while not stop_event.is_set():
            try:
                processed = await self.process_once()
            except Exception:
                logger.exception("[AI Job Worker] Poll failed")
                processed = False
            if processed:
                interval = poll_interval_seconds
                continue
            await wait_between_polls(stop_event, interval)
            # Widened after the wait, not before it: the first quiet poll is
            # still one interval away, and only a stretch of them drifts out.
            interval = min(interval * 2, ceiling)


# Core's `isValidWorkerId` accepts 1..120 characters of `[a-zA-Z0-9._:-]`, and a
# claim carrying anything else is refused. The slot suffix has to fit inside
# that, so the base is trimmed rather than the composed id overflowing.
_MAX_WORKER_ID_LENGTH = 120


def worker_id_for_slot(base: str, slot: Optional[int]) -> str:
    """Name one pool slot, or the whole process when it runs alone.

    `slot` is `None` for a single worker, which keeps the id exactly what it was
    before pooling existed — an operator reading `worker_id` on a run row sees
    no change until they ask for more than one slot.

    Slots are numbered because `ai_analysis_runs.worker_id` answers "who holds
    this run", and a pool sharing one name cannot answer it. The separator is
    `:` because Core's charset allows it and neither `uuid4()` nor a sane
    operator value contains one, so the boundary stays readable.
    """
    if slot is None:
        return base[:_MAX_WORKER_ID_LENGTH]

    suffix = f":{slot}"
    return f"{base[:_MAX_WORKER_ID_LENGTH - len(suffix)]}{suffix}"


@lru_cache(maxsize=1)
def process_worker_id_base() -> str:
    """The name this process answers to, computed once for all its slots.

    Cached rather than minted per call so a pool reads as one container: four
    slots become `worker-<id>:1` … `:4` and a reader of `ai_analysis_runs` can
    see that four runs share a machine. A fresh `uuid4()` per slot would name
    four unrelated strangers and lose that.
    """
    return os.getenv("AI_JOB_WORKER_ID") or f"worker-{uuid.uuid4()}"


def create_ai_analysis_job_worker(
    *,
    client: Optional[JobStore] = None,
    runner: Optional[AnalysisRunner] = None,
    slot: Optional[int] = None,
) -> AiAnalysisJobWorker:
    """Compose the worker from configuration, or from what a caller supplies."""
    worker_id = worker_id_for_slot(process_worker_id_base(), slot)
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
