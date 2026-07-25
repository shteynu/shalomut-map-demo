import pytest
from src.config import settings
from src.services.llm_provider import llm_provider_service

def test_gemini_key_auto_detection(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "AIzaSy_dummy_key_12345")
    monkeypatch.setattr(settings, "llm_provider", "auto")
    monkeypatch.setattr(settings, "llm_base_url", "")
    
    endpoint = llm_provider_service._resolve_endpoint("some-model")
    assert endpoint == "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

def test_gemini_model_auto_detection(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-custom-key")
    monkeypatch.setattr(settings, "llm_provider", "auto")
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
    monkeypatch.setattr(settings, "llm_base_url", "")
    
    endpoint = llm_provider_service._resolve_endpoint("gpt-4o-mini")
    assert endpoint == "https://api.openai.com/v1/chat/completions"

def test_backward_compatibility_properties(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "sk-test-compat")
    assert settings.llm_api_key == "sk-test-compat"
    assert settings.openai_api_key == "sk-test-compat"

    monkeypatch.setattr(settings, "llm_api_key", "AIzaSy_test_compat")
    assert settings.openai_api_key == "AIzaSy_test_compat"
