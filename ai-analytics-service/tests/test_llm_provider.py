import pytest
from src.config import Settings, settings
from src.services.llm_provider import llm_provider_service

LLM_KEY_ENV_VARS = (
    "LLM_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
)


def clear_llm_key_environment(monkeypatch):
    for name in LLM_KEY_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LLM_MODEL_FAST", raising=False)
    monkeypatch.delenv("LLM_MODEL_HEAVY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL_FAST", raising=False)
    monkeypatch.delenv("OPENAI_MODEL_HEAVY", raising=False)


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
