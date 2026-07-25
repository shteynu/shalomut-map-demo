import json
import urllib.error

import pytest
from src.config import Settings, settings
from src.services.llm_provider import llm_provider_service

LLM_KEY_ENV_VARS = (
    "LLM_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
)


class FakeLLMResponse:
    def __init__(self, content="תוצאה ממודל"):
        self.status = 200
        self._body = json.dumps(
            {
                "choices": [
                    {
                        "message": {
                            "content": content,
                        },
                    },
                ],
            },
        ).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return self._body


class FakeErrorBody:
    def __init__(self, body):
        self._body = body

    def read(self, *_args):
        return self._body

    def close(self):
        return None


def create_http_error(status, body=None, headers=None):
    return urllib.error.HTTPError(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        status,
        f"HTTP {status}",
        headers or {},
        FakeErrorBody(body) if body is not None else None,
    )


def configure_gemini_retry_test(monkeypatch, max_attempts=3):
    monkeypatch.setattr(settings, "llm_api_key", "opaque-google-key")
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "llm_key_provider", "gemini", raising=False)
    monkeypatch.setattr(settings, "llm_base_url", "")
    monkeypatch.setattr(settings, "llm_model_fast", "gemini-test-model")
    monkeypatch.setattr(settings, "max_tokens_per_dimension", 180)
    monkeypatch.setattr(settings, "only_llm_for_problematic", True)
    monkeypatch.setattr(
        settings,
        "llm_max_attempts",
        max_attempts,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "llm_retry_base_delay_seconds",
        0.0,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "llm_retry_max_delay_seconds",
        0.0,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "llm_retry_jitter_seconds",
        0.0,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "llm_request_timeout_seconds",
        20.0,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "llm_retry_budget_seconds",
        25.0,
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "llm_min_retry_window_seconds",
        8.0,
        raising=False,
    )


def test_transient_503_retries_then_returns_llm_result(
    monkeypatch,
    caplog,
):
    configure_gemini_retry_test(monkeypatch)
    caplog.set_level("INFO")
    responses = iter(
        [
            create_http_error(503),
            FakeLLMResponse("תוצאה אמיתית מג׳מיני"),
        ],
    )
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        response = next(responses)
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert result == "תוצאה אמיתית מג׳מיני"
    assert len(attempts) == 2
    assert "outcome=retry" in caplog.text
    assert "outcome=llm" in caplog.text
    assert "outcome=heuristic" not in caplog.text


def test_non_retryable_400_falls_back_without_retry(monkeypatch):
    configure_gemini_retry_test(monkeypatch)
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise create_http_error(400)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert "אזור אדום" in result
    assert len(attempts) == 1


def test_transient_failures_fall_back_after_bounded_attempts(monkeypatch):
    configure_gemini_retry_test(monkeypatch, max_attempts=3)
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise create_http_error(503)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert "אזור אדום" in result
    assert len(attempts) == 3


def test_quota_429_is_not_retried(monkeypatch):
    configure_gemini_retry_test(monkeypatch)
    attempts = []
    error_body = json.dumps(
        {
            "error": {
                "type": "insufficient_quota",
                "code": "insufficient_quota",
            },
        },
    ).encode("utf-8")

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise create_http_error(429, body=error_body)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert "אזור אדום" in result
    assert len(attempts) == 1


def test_transient_429_retries_when_not_a_hard_quota_error(monkeypatch):
    configure_gemini_retry_test(monkeypatch)
    responses = iter(
        [
            create_http_error(
                429,
                body=json.dumps(
                    {
                        "error": {
                            "status": "RESOURCE_EXHAUSTED",
                        },
                    },
                ).encode("utf-8"),
            ),
            FakeLLMResponse("תוצאה אחרי הגבלת קצב זמנית"),
        ],
    )
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        response = next(responses)
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert result == "תוצאה אחרי הגבלת קצב זמנית"
    assert len(attempts) == 2


def test_retry_after_is_honored_within_delay_cap(monkeypatch):
    configure_gemini_retry_test(monkeypatch)
    monkeypatch.setattr(
        settings,
        "llm_retry_max_delay_seconds",
        2.0,
    )

    error = create_http_error(
        503,
        headers={"Retry-After": "7"},
    )

    assert llm_provider_service._retry_delay_seconds(error, 1) == 2.0


def test_transport_timeout_retries_then_returns_llm_result(
    monkeypatch,
    caplog,
):
    configure_gemini_retry_test(monkeypatch)
    caplog.set_level("INFO")
    responses = iter(
        [
            TimeoutError("provider request timed out"),
            FakeLLMResponse("תוצאה אחרי timeout זמני"),
        ],
    )
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        response = next(responses)
        if isinstance(response, Exception):
            raise response
        return response

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert result == "תוצאה אחרי timeout זמני"
    assert len(attempts) == 2
    assert "outcome=retry" in caplog.text
    assert "error_type=TimeoutError" in caplog.text
    assert "outcome=heuristic" not in caplog.text


def test_transport_timeout_stops_after_two_total_attempts(monkeypatch):
    configure_gemini_retry_test(monkeypatch, max_attempts=3)
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise TimeoutError("provider request timed out")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert "אזור אדום" in result
    assert len(attempts) == 2


def test_provider_uses_configured_request_timeout(monkeypatch):
    configure_gemini_retry_test(monkeypatch)
    monkeypatch.setattr(
        "src.services.llm_provider.time.monotonic",
        lambda: 100.0,
    )
    observed_timeouts = []

    def fake_urlopen(*_args, **kwargs):
        observed_timeouts.append(kwargs["timeout"])
        return FakeLLMResponse()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert observed_timeouts == [20.0]


def test_timeout_does_not_retry_without_minimum_budget(monkeypatch):
    configure_gemini_retry_test(monkeypatch, max_attempts=3)
    clock = iter([100.0, 100.0, 120.1])
    monkeypatch.setattr(
        "src.services.llm_provider.time.monotonic",
        lambda: next(clock),
    )
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise TimeoutError("provider request timed out")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    result = llm_provider_service.generate_psychological_interpretation(
        "certainty",
        "ודאות",
        42.0,
        "red",
    )

    assert "אזור אדום" in result
    assert len(attempts) == 1


def clear_llm_key_environment(monkeypatch):
    for name in LLM_KEY_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LLM_MODEL_FAST", raising=False)
    monkeypatch.delenv("LLM_MODEL_HEAVY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL_FAST", raising=False)
    monkeypatch.delenv("OPENAI_MODEL_HEAVY", raising=False)
    monkeypatch.delenv("LLM_REQUEST_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("LLM_RETRY_BUDGET_SECONDS", raising=False)
    monkeypatch.delenv("LLM_MIN_RETRY_WINDOW_SECONDS", raising=False)


def configure_valid_production_environment(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("USE_MOCK_MCP", "false")
    monkeypatch.setenv("MCP_SHARED_SECRET", "mcp-secret")
    monkeypatch.setenv("AI_WEBHOOK_SECRET", "webhook-secret")
    monkeypatch.setenv("AI_CALLBACK_SECRET", "callback-secret")
    monkeypatch.setenv(
        "DATA_LAYER_MCP_URL",
        "https://data-layer.example/api/mcp",
    )
    monkeypatch.setenv(
        "DATA_LAYER_CALLBACK_URL",
        "https://data-layer.example/api/rounds",
    )


def test_named_gemini_key_preserves_provider_source(monkeypatch):
    clear_llm_key_environment(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "opaque-google-key")

    configured = Settings()

    assert configured.llm_api_key == "opaque-google-key"
    assert configured.llm_key_source == "GEMINI_API_KEY"
    assert configured.llm_key_provider == "gemini"
    assert configured.resolved_llm_provider() == "gemini"
    assert configured.llm_model_fast == "gemini-flash-latest"
    assert configured.llm_model_heavy == "gemini-pro-latest"


def test_explicit_provider_selects_matching_key_when_multiple_are_present(
    monkeypatch,
):
    clear_llm_key_environment(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")

    configured = Settings()

    assert configured.llm_api_key == "gemini-key"
    assert configured.llm_key_source == "GEMINI_API_KEY"
    assert configured.llm_key_provider == "gemini"
    assert configured.llm_key_configuration_error == ""


def test_multiple_named_keys_without_provider_fail_closed(monkeypatch):
    clear_llm_key_environment(monkeypatch)
    configure_valid_production_environment(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "openai-key")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-key")

    configured = Settings()

    assert configured.llm_api_key == ""
    assert "Multiple provider-specific API keys" in (
        configured.llm_key_configuration_error
    )
    assert any(
        "Multiple provider-specific API keys" in error
        for error in configured.runtime_configuration_errors()
    )


def test_generic_key_requires_provider_or_base_url_in_production(monkeypatch):
    clear_llm_key_environment(monkeypatch)
    configure_valid_production_environment(monkeypatch)
    monkeypatch.setenv("LLM_API_KEY", "opaque-key")

    configured = Settings()

    assert any(
        "LLM_PROVIDER or LLM_BASE_URL" in error
        for error in configured.runtime_configuration_errors()
    )

    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    assert not any(
        "LLM_PROVIDER or LLM_BASE_URL" in error
        for error in Settings().runtime_configuration_errors()
    )


def test_provider_source_routes_independently_of_model_name(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "llm_key_provider", "gemini", raising=False)
    monkeypatch.setattr(settings, "llm_api_key", "opaque-google-key")
    monkeypatch.setattr(settings, "llm_base_url", "")

    endpoint = llm_provider_service._resolve_endpoint("custom-model-name")

    assert endpoint == (
        "https://generativelanguage.googleapis.com/"
        "v1beta/openai/chat/completions"
    )


def test_gemini_key_auto_detection(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "AIzaSy_dummy_key_12345")
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "llm_key_provider", "", raising=False)
    monkeypatch.setattr(settings, "llm_base_url", "")
    
    endpoint = llm_provider_service._resolve_endpoint("some-model")
    assert endpoint == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

def test_gemini_model_auto_detection(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-custom-key")
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "llm_key_provider", "", raising=False)
    monkeypatch.setattr(settings, "llm_base_url", "")
    
    endpoint = llm_provider_service._resolve_endpoint("gemini-2.0-flash")
    assert endpoint == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

def test_custom_base_url(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "custom-key")
    monkeypatch.setattr(settings, "llm_base_url", "https://ollama.local:11434/v1")
    
    endpoint = llm_provider_service._resolve_endpoint("llama3")
    assert endpoint == "https://ollama.local:11434/v1/chat/completions"

def test_openai_default_endpoint(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-openai-key-123")
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "llm_key_provider", "", raising=False)
    monkeypatch.setattr(settings, "llm_base_url", "")
    
    endpoint = llm_provider_service._resolve_endpoint("gpt-4o-mini")
    assert endpoint == "https://api.openai.com/v1/chat/completions"

def test_backward_compatibility_properties(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "sk-test-compat")
    assert settings.llm_api_key == "sk-test-compat"
    assert settings.openai_api_key == "sk-test-compat"

    monkeypatch.setattr(settings, "llm_api_key", "AIzaSy_test_compat")
    assert settings.openai_api_key == "AIzaSy_test_compat"
