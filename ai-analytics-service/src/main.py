import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
)
from src.schemas.question_suggestion import (
    QuestionSuggestionRequest,
    QuestionSuggestionResponse,
)
from src.schemas.webhook import WebhookEventPayload
from src.services.analytics_runner import analytics_runner_service
from src.services.ai_job_worker import create_ai_analysis_job_worker
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)
from src.services.provider_health import (
    read_fallback_status,
    read_provider_health,
    read_provider_status,
)
from src.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shalomut-ai-service")

@asynccontextmanager
async def lifespan(application: FastAPI):
    stop_event = None
    task = None
    if settings.ai_job_polling_enabled:
        configuration_errors = settings.runtime_configuration_errors()
        if configuration_errors:
            raise RuntimeError(
                "AI job polling is enabled with invalid runtime configuration: "
                + "; ".join(configuration_errors)
            )
        stop_event = asyncio.Event()
        worker = create_ai_analysis_job_worker()
        task = asyncio.create_task(
            worker.run_forever(
                stop_event,
                settings.ai_job_poll_interval_seconds,
            )
        )
        application.state.ai_job_worker_stop = stop_event
        application.state.ai_job_worker_task = task

    try:
        yield
    finally:
        if stop_event is not None:
            stop_event.set()
        if task is not None:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


app = FastAPI(
    title="Shalomut AI Analytics Microservice",
    description="Standalone Python AI Analytics Service for Teachers' Wellbeing Map (מפת שלומות)",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
def health_check():
    """Reports what this instance actually runs.

    `commit` and `supportedContractVersions` exist so a consumer-first rollout
    can be verified from outside: Core must not start emitting a contract
    version before this endpoint proves the deployed code accepts it.
    """
    return {
        "status": "online",
        "service": settings.app_name,
        "env": settings.env,
        "privacyThreshold": settings.privacy_threshold,
        "commit": os.getenv("RENDER_GIT_COMMIT", "unknown")[:7],
        "supportedContractVersions": list(
            AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
        ),
        "jobPollingEnabled": settings.ai_job_polling_enabled,
    }

async def run_analytics_in_background(round_id: str) -> None:
    """Runs the analytics workflow after the webhook response has been sent.

    One round is roughly thirty provider calls, which outlasts any caller
    timeout worth setting. Core only needs the acknowledgement; the compiled
    Stone Map reaches it on the callback. Failures end here, so they are logged
    rather than raised: the caller is already gone, and its dispatch claim
    expires on its own lease.
    """
    try:
        await analytics_runner_service.process_round(round_id=round_id)
        logger.info(
            "[Webhook Receiver] Background analytics finished for roundId: %s",
            round_id,
        )
    except Exception:
        logger.exception(
            "[Webhook Receiver] Background analytics failed for roundId: %s",
            round_id,
        )

@app.post("/api/v1/webhook/events", status_code=202)
async def handle_webhook_event(
    payload: WebhookEventPayload,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(default=None),
):
    """
    Webhook handler for Data Layer triggers.
    Listens for {"event": "round_closed", "roundId": "uuid"}

    Answers `202 Accepted` as soon as the request is authenticated and the
    runtime configuration checks out, then processes the round in the
    background. Every rejection above stays synchronous, so a misconfigured or
    unauthorized caller still learns why.
    """
    if settings.env != "development" and not settings.ai_webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="AI_WEBHOOK_SECRET is required outside development",
        )

    if (
        settings.ai_webhook_secret
        and authorization != f"Bearer {settings.ai_webhook_secret}"
    ):
        raise HTTPException(status_code=401, detail="Unauthorized webhook")

    configuration_errors = settings.runtime_configuration_errors()
    if configuration_errors:
        raise HTTPException(
            status_code=503,
            detail="; ".join(configuration_errors),
        )

    logger.info(f"[Webhook Receiver] Received event: {payload.event} for roundId: {payload.roundId}")
    
    if payload.event not in ["round_closed", "analytics_requested"]:
        raise HTTPException(status_code=400, detail=f"Unsupported event type: {payload.event}")

    background_tasks.add_task(run_analytics_in_background, payload.roundId)

    return {
        "status": "accepted",
        "message": f"Analytics processing accepted for round {payload.roundId}",
        "roundId": payload.roundId,
    }

@app.get("/api/v1/provider-status")
def provider_status():
    """One word, anonymously, so a free watchdog can see a dead model.

    `answering`, `failing` or `unknown`, and nothing else — no reason, no model,
    no counts, no timing. Those stay behind the secret on `/api/v1/provider-health`
    below, because they are what turns "the model is down" into "the account has
    no credit", and Core's own `/api/health` states the rule about publishing
    credential state to anonymous callers.

    This exists because the alternative did not: UptimeRobot's free plan locks
    `Request headers` to its paid tiers, read in the monitor form itself on
    2026-08-17, so no free monitor can present a bearer token. Owner decision the
    same day, of four: publish the word rather than pay, add a second monitoring
    service, or keep no watchdog at all.

    Deliberately its own path rather than a field on `/health`. The existing
    keep-alive monitor keys on `"status":"online"` there, and two watchdogs
    sharing one body is how a change made for one of them quietly breaks the
    other.
    """
    return read_provider_status()

@app.get("/api/v1/fallback-status")
def fallback_status():
    """One word, anonymously, so a free watchdog can see a half-written map.

    `writing`, `degraded` or `unknown`. `/api/v1/provider-status` answers "is the
    model down"; this answers "is the model still writing the map", and the two
    are not the same question. The provider word follows the last conversation,
    so a round whose final call succeeded reads `answering` while most of its
    dimensions carry copy the service derived from the aggregates. That is the
    2026-08-09 incident exactly — eight stones out of the fallback, the round
    reported success, and the detector that saw it wrote to `console.info` in
    Core with nothing on the other end.

    Its own path rather than a second field beside the provider word, for the
    reason that endpoint states above: two monitors reading one body is how a
    change made for one of them quietly breaks the other.

    Anonymous on the same grounds and no wider: UptimeRobot's free plan locks
    request headers to its paid tiers, so a free monitor can present no token,
    and what is published here is a state of the product rather than of the
    account. The ratio, the window and the counts stay behind the secret on
    `/api/v1/provider-health`.
    """
    return read_fallback_status()

@app.get("/api/v1/provider-health")
def provider_health(authorization: Optional[str] = Header(default=None)):
    """Whether the provider is answering this instance, as one authenticated read.

    Separate from `/health` and behind the inbound secret, both deliberately.
    `/health` is anonymous, and Core's own `/api/health` states the rule this
    follows: an endpoint that reports provider or credential state tells an
    anonymous caller where to push. Whether the account behind the key has
    credit is exactly that class of fact — `reason=http_429` reads as "they ran
    out of money" to anyone who can spell it.

    Owner decision, 2026-08-17: of three placements — anonymous on `/health`,
    behind this secret, or manager-gated in Core — take the secret. It keeps the
    reading one request for whoever operates the service and publishes nothing.

    Authentication is the same inbound secret the webhook and the suggestion
    endpoint use, in the same shape, for the same reason: it is the same caller
    in the same direction, and a second secret would be another thing to rotate
    for a boundary that is already drawn.

    This never calls the provider. It reports what real work last observed, and
    says `unknown` when this process has observed nothing — see
    `provider_health.py` for why absence of a failure is not health.
    """
    if settings.env != "development" and not settings.ai_webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="AI_WEBHOOK_SECRET is required outside development",
        )

    if (
        settings.ai_webhook_secret
        and authorization != f"Bearer {settings.ai_webhook_secret}"
    ):
        raise HTTPException(status_code=401, detail="Unauthorized health request")

    return read_provider_health()

@app.post("/api/v1/questions/suggest")
async def suggest_question(
    payload: QuestionSuggestionRequest,
    authorization: Optional[str] = Header(default=None),
):
    """Draft one more questionnaire item for one dimension.

    Synchronous, unlike the webhook: a manager is waiting on the answer, and it
    is a single provider request rather than a round's worth. The round pipeline
    is untouched — no MCP read, no callback, no persistence — so the
    `runtime_configuration_errors` gate that guards a round does not apply here;
    what this endpoint needs is the provider key, and the transport fails closed
    without it.

    Authentication is the same inbound secret the webhook uses. It is the same
    caller in the same direction, and a second secret would be a fourth thing to
    rotate for no boundary that is not already drawn.
    """
    if settings.env != "development" and not settings.ai_webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="AI_WEBHOOK_SECRET is required outside development",
        )

    if (
        settings.ai_webhook_secret
        and authorization != f"Bearer {settings.ai_webhook_secret}"
    ):
        raise HTTPException(status_code=401, detail="Unauthorized suggestion request")

    if payload.dimensionId not in AI_ANALYTICS_DIMENSION_IDS:
        # The id is not echoed back: it came from the caller, and the caller
        # already knows what it sent.
        raise HTTPException(
            status_code=400,
            detail="Unsupported dimension id for a question suggestion",
        )

    logger.info(
        "[Question Suggestion] Requested for dimension: %s",
        payload.dimensionId,
    )

    try:
        suggestion = await asyncio.to_thread(
            llm_provider_service.suggest_question_result,
            dimension_id=payload.dimensionId,
            dimension_hebrew=AI_ANALYTICS_DIMENSION_NAMES_HEBREW[
                payload.dimensionId
            ],
            existing_texts=payload.bounded_existing_texts(),
            style_texts=payload.bounded_style_texts(),
        )
    except ProviderUnavailableError as error:
        raise HTTPException(
            status_code=503,
            detail=f"Question suggestion unavailable: {error.reason}",
        )

    return QuestionSuggestionResponse(
        dimensionId=payload.dimensionId,
        dimensionNameHebrew=AI_ANALYTICS_DIMENSION_NAMES_HEBREW[
            payload.dimensionId
        ],
        questionText=suggestion.text,
        attempts=suggestion.attempts,
    ).to_dict()


@app.post("/api/v1/rounds/{round_id}/analyze")
async def analyze_round_direct(round_id: str):
    """
    Direct synchronous endpoint for local development only.
    """
    if settings.env != "development":
        raise HTTPException(status_code=404, detail="Not Found")

    result = await analytics_runner_service.process_round(round_id=round_id)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host=settings.host, port=settings.port, reload=True)
