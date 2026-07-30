import asyncio
import logging
import os
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
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)
from src.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shalomut-ai-service")

app = FastAPI(
    title="Shalomut AI Analytics Microservice",
    description="Standalone Python AI Analytics Service for Teachers' Wellbeing Map (מפת שלומות)",
    version="0.1.0"
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
