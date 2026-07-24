from fastapi.testclient import TestClient
from src.main import app

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
    response = client.post("/api/v1/webhook/events", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["roundId"] == "test-round-123"

def test_analyze_round_direct():
    response = client.post("/api/v1/rounds/round-unlocked-sample/analyze")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "stones" in data
