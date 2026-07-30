import json
import logging
import urllib.error

import pytest
from src.config import Settings, settings
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)

LLM_KEY_ENV_VARS = (
    "LLM_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
)

BALANCE_QUESTION_AGGREGATES = [
    {
        "questionId": "balance-1",
        "dimensionId": "balance",
        "questionTextHebrew": (
            "אני מצליחה לבצע את משימות העבודה בזמן שנקבע."
        ),
        "averageScore": 80.0,
        "responseCount": 12,
    },
    {
        "questionId": "balance-2",
        "dimensionId": "balance",
        "questionTextHebrew": (
            "יש לי מספיק זמן למנוחה ולהתאוששות אחרי העבודה."
        ),
        "averageScore": 20.0,
        "responseCount": 12,
    },
    {
        "questionId": "balance-3",
        "dimensionId": "balance",
        "questionTextHebrew": (
            "אני מרגישה שהעומס בעבודה מתאים לי והוא בהישג יד."
        ),
        "averageScore": 40.0,
        "responseCount": 12,
    },
]


class FakeLLMResponse:
    def __init__(
        self,
        content=(
            "הנתונים המצרפיים התקבלו מן המודל. "
            "הפירוש נשען על מדדי השאלות בלבד."
        ),
        finish_reason="stop",
    ):
        self.status = 200
        self._body = json.dumps(
            {
                "choices": [
                    {
                        "finish_reason": finish_reason,
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


class FakeRawResponse:
    def __init__(self, body: bytes):
        self.status = 200
        self._body = body

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
            FakeLLMResponse(
                "התקבלה תוצאה אמיתית מן המודל. "
                "הפירוש נשען על הנתונים המצרפיים."
            ),
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

    assert result == (
        "התקבלה תוצאה אמיתית מן המודל. "
        "הפירוש נשען על הנתונים המצרפיים."
    )
    assert len(attempts) == 2
    assert "outcome=retry" in caplog.text
    assert "outcome=llm" in caplog.text
    assert "outcome=heuristic" not in caplog.text


def test_non_retryable_400_fails_the_dimension_without_retry(monkeypatch):
    configure_gemini_retry_test(monkeypatch)
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise create_http_error(400)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
        )

    assert failure.value.reason == "http_400"
    assert failure.value.dimension_id == "certainty"
    assert len(attempts) == 1


def test_transient_failures_give_up_after_bounded_attempts(monkeypatch):
    configure_gemini_retry_test(monkeypatch, max_attempts=3)
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise create_http_error(503)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
        )

    assert failure.value.reason == "http_503"
    assert len(attempts) == 3


def test_semantically_invalid_output_retries_then_records_llm_provenance(
    monkeypatch,
):
    configure_gemini_retry_test(monkeypatch, max_attempts=2)
    responses = iter(
        [
            FakeLLMResponse(
                "הפלט נקטע לפני שהושלם",
                finish_reason="length",
            ),
            FakeLLMResponse(
                "ממוצעי השאלות מצביעים על פער בתחום האיזון. "
                "השאלה על זמן ההתאוששות דורשת תשומת לב."
            ),
        ],
    )
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        return next(responses)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    generation = (
        llm_provider_service.generate_psychological_interpretation_result(
            "balance",
            "איזון",
            46.7,
            "red",
            question_aggregates=BALANCE_QUESTION_AGGREGATES,
        )
    )

    assert generation.outcome == "llm"
    assert generation.attempts == 2
    assert generation.retry_count == 1
    assert len(attempts) == 2


def test_output_that_never_becomes_valid_fails_the_dimension(
    monkeypatch,
):
    """Output the validators keep refusing is not a reason to write copy here.

    The attempt budget is spent in full first, so this is the provider failing
    to deliver, reported as such rather than papered over.
    """
    configure_gemini_retry_test(monkeypatch, max_attempts=2)
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        return FakeLLMResponse(
            "Provider output remained incomplete",
            finish_reason="length",
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation_result(
            "balance",
            "איזון",
            46.7,
            "red",
            question_aggregates=BALANCE_QUESTION_AGGREGATES,
        )

    assert failure.value.reason == "invalid_finish_reason"
    assert failure.value.dimension_id == "balance"
    assert len(attempts) == 2


def test_the_log_names_the_finish_reason_the_provider_actually_sent(
    monkeypatch,
    caplog,
):
    """`invalid_finish_reason` alone cannot tell three failures apart.

    Truncation, a safety block and recitation all land on that one label and
    all want different fixes, so the value behind it has to reach the log. A
    live round on 2026-07-29 hit this and the log could not say which it was.
    """
    configure_gemini_retry_test(monkeypatch, max_attempts=2)

    def fake_urlopen(*_args, **_kwargs):
        return FakeLLMResponse(
            "Provider output the validators refuse",
            finish_reason="content_filter",
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with caplog.at_level(logging.WARNING, logger="src.services.llm_transport"):
        with pytest.raises(ProviderUnavailableError):
            llm_provider_service.generate_psychological_interpretation_result(
                "balance",
                "איזון",
                46.7,
                "red",
                question_aggregates=BALANCE_QUESTION_AGGREGATES,
            )

    messages = [record.getMessage() for record in caplog.records]
    retries = [m for m in messages if "outcome=retry" in m]
    exhausted = [m for m in messages if "outcome=no_answer" in m]

    assert retries, "the retry itself must still be logged"
    assert all("finish_reason=content_filter" in m for m in retries)
    # The exhausted attempt used to break out silently, so the finish_reason of
    # the last try — the only one that decides the dimension — was lost.
    assert exhausted, "an exhausted attempt budget must say so"
    assert "reason=invalid_finish_reason" in exhausted[0]
    assert "finish_reason=content_filter" in exhausted[0]


def test_malformed_provider_response_uses_the_same_bounded_retry(
    monkeypatch,
):
    configure_gemini_retry_test(monkeypatch, max_attempts=2)
    responses = iter(
        [
            FakeRawResponse(b"{truncated-json"),
            FakeLLMResponse(
                "ממוצעי השאלות מצביעים על פער בתחום האיזון. "
                "השאלה על זמן ההתאוששות דורשת תשומת לב."
            ),
        ],
    )
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        return next(responses)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    generation = (
        llm_provider_service.generate_psychological_interpretation_result(
            "balance",
            "איזון",
            46.7,
            "red",
            question_aggregates=BALANCE_QUESTION_AGGREGATES,
        )
    )

    assert generation.outcome == "llm"
    assert generation.attempts == 2
    assert generation.retry_count == 1
    assert len(attempts) == 2


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

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
        )

    assert failure.value.reason == "http_429"
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
            FakeLLMResponse(
                "התקבלה תוצאה לאחר הגבלת קצב זמנית. "
                "הפירוש נשען על הנתונים המצרפיים."
            ),
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

    assert result == (
        "התקבלה תוצאה לאחר הגבלת קצב זמנית. "
        "הפירוש נשען על הנתונים המצרפיים."
    )
    assert len(attempts) == 2


def test_retry_after_outranks_the_local_backoff_cap(monkeypatch):
    """A wait the provider asked for is not shortened to one we prefer.

    `LLM_RETRY_MAX_DELAY_SECONDS` bounds the backoff this service invents. Held
    against `Retry-After` as well, it aimed every retry at the window that had
    just refused it — the free tier says come back in seven seconds, and two
    seconds later we asked again. What bounds this wait instead is the retry
    budget, which declines one it cannot hold.
    """
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

    assert llm_provider_service._retry_delay_seconds(error, 1) == 7.0
    # The cap still bounds what this service comes up with on its own.
    monkeypatch.setattr(
        settings,
        "llm_retry_base_delay_seconds",
        5.0,
    )
    assert (
        llm_provider_service._retry_delay_seconds(
            create_http_error(503),
            1,
        )
        == 2.0
    )


def test_transport_timeout_retries_then_returns_llm_result(
    monkeypatch,
    caplog,
):
    configure_gemini_retry_test(monkeypatch)
    caplog.set_level("INFO")
    responses = iter(
        [
            TimeoutError("provider request timed out"),
            FakeLLMResponse(
                "התקבלה תוצאה לאחר עיכוב זמני. "
                "הפירוש נשען על הנתונים המצרפיים."
            ),
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

    assert result == (
        "התקבלה תוצאה לאחר עיכוב זמני. "
        "הפירוש נשען על הנתונים המצרפיים."
    )
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

    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
        )

    assert failure.value.reason == "TimeoutError"
    assert len(attempts) == 2


def test_provider_uses_configured_request_timeout(monkeypatch):
    configure_gemini_retry_test(monkeypatch)
    monkeypatch.setattr(
        "src.services.llm_transport.time.monotonic",
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
        "src.services.llm_transport.time.monotonic",
        lambda: next(clock),
    )
    attempts = []

    def fake_urlopen(*_args, **_kwargs):
        attempts.append(True)
        raise TimeoutError("provider request timed out")

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with pytest.raises(ProviderUnavailableError):
        llm_provider_service.generate_psychological_interpretation(
            "certainty",
            "ודאות",
            42.0,
            "red",
        )

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


V5_BALANCE_AGGREGATES = [
    {
        "questionId": "q-1",
        "dimensionId": "balance",
        "questionText": "אני מצליחה לסיים את המשימות בזמן שנקבע.",
        "averageScore": 60.0,
        "responseCount": 20,
        "scoreDistribution": {"green": 4, "yellow": 12, "red": 4},
    },
    {
        "questionId": "q-2",
        "dimensionId": "balance",
        "questionText": "אני מצליחה להתנתק מהעבודה בסוף היום.",
        "averageScore": 55.0,
        "responseCount": 20,
        "scoreDistribution": {"green": 3, "yellow": 10, "red": 7},
    },
]

# 12 + 4 answered yellow, 4 + 7 answered red — a faithful report of a yellow
# dimension whose prompt states exactly those buckets.
DISTRIBUTION_REPORT_YELLOW = (
    "רוב הצוות דיווח בטווח צהוב, אך 7 משיבים סימנו אדום בשאלת הניתוק מהעבודה. "
    "התמונה המצרפית מצביעה על עומס שראוי לעקוב אחריו."
)
VERDICT_CONTRADICTION_YELLOW = (
    "המדד נמצא באזור אדום ודורש התייחסות. הנתונים מצביעים על עומס מתמשך."
)


def test_distribution_counts_covers_questions_and_dimension_totals():
    counts = llm_provider_service.distribution_counts(V5_BALANCE_AGGREGATES)

    assert counts is not None
    # Per-question buckets.
    assert {"4", "12", "3", "10", "7"} <= counts
    # Per-bucket totals across the dimension: 7 green, 22 yellow, 11 red.
    assert {"7", "22", "11"} <= counts
    assert llm_provider_service.distribution_counts([]) is None
    assert (
        llm_provider_service.distribution_counts(
            [{"questionId": "q-1", "averageScore": 60.0}],
        )
        is None
    )


def test_v5_accepts_an_interpretation_that_quotes_the_distribution():
    counts = llm_provider_service.distribution_counts(V5_BALANCE_AGGREGATES)

    assert llm_provider_service.is_status_consistent(
        DISTRIBUTION_REPORT_YELLOW,
        "yellow",
        contract_version="5.0",
        distribution_counts=counts,
    )


def test_v5_rejects_a_colour_that_matches_no_bucket():
    counts = llm_provider_service.distribution_counts(V5_BALANCE_AGGREGATES)
    invented = (
        "רוב הצוות דיווח בטווח צהוב, אך 99 משיבים סימנו אדום. "
        "התמונה המצרפית מצביעה על עומס שראוי לעקוב אחריו."
    )

    assert not llm_provider_service.is_status_consistent(
        invented,
        "yellow",
        contract_version="5.0",
        distribution_counts=counts,
    )


def test_v5_rejects_a_verdict_in_another_status_colour():
    counts = llm_provider_service.distribution_counts(V5_BALANCE_AGGREGATES)

    assert not llm_provider_service.is_status_consistent(
        VERDICT_CONTRADICTION_YELLOW,
        "yellow",
        contract_version="5.0",
        distribution_counts=counts,
    )
    # A verdict stays a contradiction even when the sentence carries a count.
    assert not llm_provider_service.is_status_consistent(
        "המדד נמצא באזור אדום לפי 4 משיבים. יש לפעול בהתאם.",
        "yellow",
        contract_version="5.0",
        distribution_counts=counts,
    )


def test_earlier_contracts_keep_the_flat_colour_blacklist():
    counts = llm_provider_service.distribution_counts(V5_BALANCE_AGGREGATES)

    for version in ("2.0", "3.0", "4.0"):
        assert not llm_provider_service.is_status_consistent(
            DISTRIBUTION_REPORT_YELLOW,
            "yellow",
            contract_version=version,
            distribution_counts=counts,
        )
    # Default call sites (nodes on 2.0-4.0) behave the same.
    assert not llm_provider_service.is_status_consistent(
        DISTRIBUTION_REPORT_YELLOW,
        "yellow",
    )


def test_v5_without_a_distribution_falls_back_to_the_flat_rule():
    assert not llm_provider_service.is_status_consistent(
        DISTRIBUTION_REPORT_YELLOW,
        "yellow",
        contract_version="5.0",
        distribution_counts=None,
    )


def test_judgement_phrases_stay_blacklisted_for_green_on_5_0():
    """A verdict of distress still contradicts a green score.

    What this test asserted until 2026-07-30 was `יש לשפר` — improving the
    dimension — which is not a verdict of distress but what a school does with a
    strength. The phrase left the rule; the verdicts stayed. The whole green
    rule, and the deniable claim beside it, is in `test_green_dimensions.py`.
    """
    counts = llm_provider_service.distribution_counts(V5_BALANCE_AGGREGATES)

    assert not llm_provider_service.is_status_consistent(
        "הממד מצביע על מצוקה מבנית בצוות. הנתונים מחייבים בחינה מחדש.",
        "green",
        contract_version="5.0",
        distribution_counts=counts,
    )
    assert llm_provider_service.is_status_consistent(
        "הממד יציב אך יש לשפר את העומס. הצוות מדווח על תמונה חיובית.",
        "green",
        contract_version="5.0",
        distribution_counts=counts,
    )


def test_max_tokens_per_dimension_comes_from_the_environment(monkeypatch):
    """The cap must be tunable without a code change, and default high.

    The default covers what a reasoning model spends before it writes: on
    gemini-flash-latest one interpretation cost 1440 thinking tokens against
    108 visible ones, and the earlier defaults of 180 and 420 were consumed
    entirely by thinking, so every dimension came back truncated and empty.
    """
    for variable in LLM_KEY_ENV_VARS:
        monkeypatch.delenv(variable, raising=False)

    monkeypatch.delenv("MAX_TOKENS_PER_DIMENSION", raising=False)
    assert Settings().max_tokens_per_dimension == 2048

    monkeypatch.setenv("MAX_TOKENS_PER_DIMENSION", "512")
    assert Settings().max_tokens_per_dimension == 512


def test_request_uses_the_configured_token_cap(monkeypatch):
    captured = {}

    class _Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps(
                {
                    "choices": [
                        {
                            "finish_reason": "stop",
                            "message": {
                                "content": (
                                    "מדד האיזון מציג תמונה מצרפית יציבה. "
                                    "הנתונים תומכים בהמשך מעקב."
                                ),
                            },
                        },
                    ],
                },
            ).encode("utf-8")

    def fake_urlopen(request, timeout=None):
        captured.update(json.loads(request.data.decode("utf-8")))
        return _Response()

    monkeypatch.setattr(settings, "llm_api_key", "sk-test-token-cap")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "max_tokens_per_dimension", 333)
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    for version in ("4.0", "5.0"):
        captured.clear()
        llm_provider_service.generate_psychological_interpretation_result(
            dim_id="balance",
            dim_hebrew="איזון",
            score=60.0,
            status="yellow",
            question_aggregates=V5_BALANCE_AGGREGATES,
            contract_version=version,
        )
        assert captured["max_tokens"] == 333, version
