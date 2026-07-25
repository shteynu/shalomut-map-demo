import logging
from typing import Optional
from fastapi import FastAPI, Header, HTTPException
from src.schemas.webhook import WebhookEventPayload
from src.services.analytics_runner import analytics_runner_service
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
    return {
        "status": "online",
        "service": settings.app_name,
        "env": settings.env,
        "privacyThreshold": settings.privacy_threshold
    }

@app.post("/api/v1/webhook/events")
async def handle_webhook_event(
    payload: WebhookEventPayload,
    authorization: Optional[str] = Header(default=None),
):
    """
    Webhook handler for Data Layer triggers.
    Listens for {"event": "round_closed", "roundId": "uuid"}
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

    result = await analytics_runner_service.process_round(round_id=payload.roundId)

    return {
        "status": "completed",
        "message": f"Analytics processing completed for round {payload.roundId}",
        "roundId": payload.roundId,
        "resultStatus": result.get("status"),
    }

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
