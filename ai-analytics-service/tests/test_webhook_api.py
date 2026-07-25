from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from src.main import app
from src.config import Settings, settings
from src.services.analytics_runner import analytics_runner_service

client = TestClient(app)

def configure_production_settings(monkeypatch, **overrides):
    values = {
        "env": "production",
        "data_layer_mcp_url": "https://data-layer.example/api/mcp",
        "data_layer_callback_url": "https://data-layer.example/api/rounds",
        "use_mock_mcp": False,
        "mcp_shared_secret": "mcp-secret",
        "ai_webhook_secret": "webhook-secret",
        "ai_callback_secret": "callback-secret",
        **overrides,
    }
    for name, value in values.items():
        monkeypatch.setattr(settings, name, value)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"

def test_webhook_event_accepted():
    payload = {
        "event": "round_closed",
        "roundId": "test-round-123",
        "callbackUrl": "https://attacker.example/collect"
    }
    previous_env = settings.env
    settings.env = "development"
    process_round = AsyncMock(return_value={"status": "success"})

    try:
        with patch.object(
            analytics_runner_service,
            "process_round",
            new=process_round,
        ):
            response = client.post("/api/v1/webhook/events", json=payload)
    finally:
        settings.env = previous_env

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["roundId"] == "test-round-123"
    process_round.assert_awaited_once_with(round_id="test-round-123")

def test_analyze_round_direct_is_disabled_outside_development():
    previous_env = settings.env
    settings.env = "production"
    process_round = AsyncMock(return_value={"status": "success", "stones": {}})

    try:
        with patch.object(
            analytics_runner_service,
            "process_round",
            new=process_round,
        ):
            response = client.post("/api/v1/rounds/round-unlocked-sample/analyze")
    finally:
        settings.env = previous_env

    assert response.status_code == 404
    process_round.assert_not_awaited()

def test_analyze_round_direct_is_available_in_development():
    previous_env = settings.env
    settings.env = "development"

    try:
        with patch.object(
            analytics_runner_service,
            "process_round",
            new=AsyncMock(return_value={"status": "success", "stones": {}}),
        ):
            response = client.post("/api/v1/rounds/round-unlocked-sample/analyze")
    finally:
        settings.env = previous_env

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "stones" in data

def test_environment_defaults_to_production_when_unset(monkeypatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("VERCEL_ENV", raising=False)

    assert Settings().env == "production"

def test_production_configuration_rejects_local_data_layer_and_mock(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("USE_MOCK_MCP", "true")
    monkeypatch.setenv("MCP_SHARED_SECRET", "mcp-secret")
    monkeypatch.setenv("AI_WEBHOOK_SECRET", "webhook-secret")
    monkeypatch.setenv("AI_CALLBACK_SECRET", "callback-secret")
    monkeypatch.delenv("DATA_LAYER_MCP_URL", raising=False)
    monkeypatch.delenv("DATA_LAYER_CALLBACK_URL", raising=False)

    errors = Settings().runtime_configuration_errors()

    assert any("DATA_LAYER_MCP_URL" in error for error in errors)
    assert any("DATA_LAYER_CALLBACK_URL" in error for error in errors)
    assert any("USE_MOCK_MCP" in error for error in errors)

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

def test_webhook_requires_complete_outbound_security_configuration(monkeypatch):
    process_round = AsyncMock(return_value={"status": "success"})
    configure_production_settings(
        monkeypatch,
        mcp_shared_secret="",
        ai_callback_secret="",
    )

    with patch.object(
        analytics_runner_service,
        "process_round",
        new=process_round,
    ):
        response = client.post(
            "/api/v1/webhook/events",
            headers={"Authorization": "Bearer webhook-secret"},
            json={
                "event": "round_closed",
                "roundId": "test-round-123",
            },
        )

    assert response.status_code == 503
    assert "MCP_SHARED_SECRET" in response.json()["detail"]
    assert "AI_CALLBACK_SECRET" in response.json()["detail"]
    process_round.assert_not_awaited()

def test_webhook_authenticates_before_reporting_outbound_configuration(
    monkeypatch,
):
    process_round = AsyncMock(return_value={"status": "success"})
    configure_production_settings(
        monkeypatch,
        mcp_shared_secret="",
        ai_callback_secret="",
    )

    with patch.object(
        analytics_runner_service,
        "process_round",
        new=process_round,
    ):
        response = client.post(
            "/api/v1/webhook/events",
            headers={"Authorization": "Bearer wrong-secret"},
            json={
                "event": "round_closed",
                "roundId": "test-round-123",
            },
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Unauthorized webhook"
    process_round.assert_not_awaited()

def test_webhook_accepts_complete_production_security_configuration(monkeypatch):
    process_round = AsyncMock(return_value={"status": "success"})
    configure_production_settings(monkeypatch)

    with patch.object(
        analytics_runner_service,
        "process_round",
        new=process_round,
    ):
        response = client.post(
            "/api/v1/webhook/events",
            headers={"Authorization": "Bearer webhook-secret"},
            json={
                "event": "round_closed",
                "roundId": "test-round-123",
            },
        )

    assert response.status_code == 200
    process_round.assert_awaited_once_with(round_id="test-round-123")
