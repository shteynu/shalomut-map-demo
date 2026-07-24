import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.schemas.webhook import WebhookEventPayload
from src.schemas.mcp_types import StoneMapResult
from src.services.analytics_runner import analytics_runner_service
from src.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shalomut-ai-service")

app = FastAPI(
    title="Shalomut AI Analytics Microservice",
    description="Standalone Python AI Analytics Service for Teachers' Wellbeing Map (מפת שלומות)",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
async def handle_webhook_event(payload: WebhookEventPayload, background_tasks: BackgroundTasks):
    """
    Webhook handler for Data Layer triggers.
    Listens for {"event": "round_closed", "roundId": "uuid"}
    """
    logger.info(f"[Webhook Receiver] Received event: {payload.event} for roundId: {payload.roundId}")
    
    if payload.event not in ["round_closed", "analytics_requested"]:
        raise HTTPException(status_code=400, detail=f"Unsupported event type: {payload.event}")

    # Dispatch background task to execute LangGraph pipeline asynchronously
    background_tasks.add_task(
        analytics_runner_service.process_round,
        round_id=payload.roundId,
        callback_url=payload.callbackUrl
    )

    return {
        "status": "accepted",
        "message": f"Analytics processing queued for round {payload.roundId}",
        "roundId": payload.roundId
    }

@app.post("/api/v1/rounds/{round_id}/analyze")
async def analyze_round_direct(round_id: str):
    """
    Direct synchronous endpoint for testing or immediate execution.
    """
    result = await analytics_runner_service.process_round(round_id=round_id)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host=settings.host, port=settings.port, reload=True)
