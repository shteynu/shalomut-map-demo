from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from src.main import app
from src.config import settings
from src.services.analytics_runner import analytics_runner_service

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"

def test_webhook_event_accepted():
    payload = {
        "event": "round_closed",
        "roundId": "test-round-123",
        "callbackUrl": "http://localhost:3000/api/rounds/test-round-123/ai-insights"
    }
    with patch.object(
        analytics_runner_service,
        "process_round",
        new=AsyncMock(return_value={"status": "success"}),
    ):
        response = client.post("/api/v1/webhook/events", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["roundId"] == "test-round-123"

def test_analyze_round_direct():
    with patch.object(
        analytics_runner_service,
        "process_round",
        new=AsyncMock(return_value={"status": "success", "stones": {}}),
    ):
        response = client.post("/api/v1/rounds/round-unlocked-sample/analyze")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "stones" in data

def test_webhook_requires_a_secret_outside_development():
    previous_env = settings.env
    previous_secret = settings.ai_webhook_secret
    settings.env = "preview"
    settings.ai_webhook_secret = ""

    try:
        response = client.post(
            "/api/v1/webhook/events",
            json={
                "event": "round_closed",
                "roundId": "test-round-123",
                "callbackUrl": "https://example.test/callback",
            },
        )
    finally:
        settings.env = previous_env
        settings.ai_webhook_secret = previous_secret

    assert response.status_code == 503
