"""One bounded conversation with a provider, and nothing about its content.

Every generation in the service goes through `complete_with_retries`, so no
second one can quietly get a weaker transport than the interpretations: same
attempt cap, retry budget, backoff, Retry-After handling, hard-quota rules and
log lines. What counts as an acceptable answer is the caller's business and
arrives as a predicate — this module never reads the Hebrew it carries.
"""

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import logging
import random
import time
from typing import Callable, Optional, Tuple
import urllib.error
import urllib.request

from src.config import settings
from src.services.hebrew_validation import sanitize_model_text

logger = logging.getLogger(__name__)

NON_RETRYABLE_QUOTA_CODES = frozenset(
    {
        "billing_hard_limit_reached",
        "insufficient_quota",
        "quota_exceeded",
    },
)


class ProviderUnavailableError(RuntimeError):
    """The provider produced nothing usable for a call that must be model-written.

    Raised instead of substituting deterministic copy. A round the model could
    not write is reported to the manager as an unavailable analysis service —
    never as an analysis. The reason is the same bounded-transport reason the
    logs carry (``http_429``, ``missing_api_key``, ``invalid_semantic_output``
    …), so a stored failure says what actually happened.
    """

    def __init__(self, reason: str, *, dimension_id: Optional[str] = None):
        super().__init__(
            f"AI provider unavailable: {reason or 'provider_error'}"
        )
        self.reason = reason or "provider_error"
        self.dimension_id = dimension_id


def resolve_endpoint(model_name: str) -> str:
    """
    Resolves the appropriate REST API completion endpoint based on configuration,
    explicit LLM_PROVIDER setting, API key pattern, or model name convention.
    """
    base_url = settings.llm_base_url.rstrip("/")
    if base_url:
        if base_url.endswith("/chat/completions"):
            return base_url
        return f"{base_url}/chat/completions"

    provider = settings.resolved_llm_provider(model_name)

    if provider == "gemini":
        return (
            "https://generativelanguage.googleapis.com/"
            "v1beta/openai/chat/completions"
        )

    if provider == "openrouter":
        return "https://openrouter.ai/api/v1/chat/completions"

    if provider == "openai":
        return "https://api.openai.com/v1/chat/completions"

    raise ValueError(
        f"Unsupported LLM provider '{provider}' without LLM_BASE_URL"
    )


def complete_with_retries(
    *,
    build_prompt: Callable[[], str],
    system_prompt: str,
    model_name: str,
    is_acceptable: Callable[[str, object], bool],
) -> Tuple[Optional[str], int, str]:
    """Run one bounded provider conversation and report what happened.

    Returns the accepted text (or None), how many attempts were made and
    the reason a caller has to fall back.
    """
    provider = settings.resolved_llm_provider(model_name)
    attempts = 0
    if not settings.llm_api_key:
        return None, attempts, "missing_api_key"

    fallback_reason = "provider_error"
    try:
        endpoint = resolve_endpoint(model_name)
        req_payload = json.dumps({
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": build_prompt()}
            ],
            "max_tokens": settings.max_tokens_per_dimension,
            "temperature": 0.2
        }).encode("utf-8")

        req = urllib.request.Request(
            endpoint,
            data=req_payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.llm_api_key}"
            },
            method="POST"
        )
        request_started_at = time.monotonic()
        for attempt in range(1, settings.llm_max_attempts + 1):
            try:
                remaining_budget = _remaining_retry_budget(
                    request_started_at,
                )
                if remaining_budget < 0.1:
                    fallback_reason = "retry_budget_exhausted"
                    logger.warning(
                        "[LLM Service] "
                        "outcome=no_answer "
                        "provider=%s model=%s reason=%s "
                        "attempts=%s",
                        provider,
                        model_name,
                        fallback_reason,
                        attempts,
                    )
                    break
                attempts = attempt
                request_timeout = min(
                    settings.llm_request_timeout_seconds,
                    remaining_budget,
                )
                with urllib.request.urlopen(
                    req,
                    timeout=request_timeout,
                ) as response:
                    if response.status == 200:
                        fallback_reason = ""
                        try:
                            res = json.loads(
                                response.read().decode("utf-8"),
                            )
                            choice = res["choices"][0]
                            content = choice["message"]["content"]
                            if not isinstance(content, str):
                                raise TypeError(
                                    "Provider content must be text"
                                )
                            result = sanitize_model_text(content)
                            finish_reason = choice.get(
                                "finish_reason",
                            )
                        except (
                            IndexError,
                            KeyError,
                            TypeError,
                            UnicodeDecodeError,
                            json.JSONDecodeError,
                        ):
                            result = ""
                            finish_reason = None
                            fallback_reason = (
                                "invalid_provider_response"
                            )
                        if is_acceptable(result, finish_reason):
                            logger.info(
                                "[LLM Service] outcome=llm "
                                "provider=%s model=%s attempt=%s",
                                provider,
                                model_name,
                                attempt,
                            )
                            return result, attempts, ""

                        if fallback_reason != "invalid_provider_response":
                            fallback_reason = (
                                "invalid_finish_reason"
                                if finish_reason != "stop"
                                else "invalid_semantic_output"
                            )
                        # `invalid_finish_reason` collapses truncation, a
                        # safety block and recitation into one label, and the
                        # three want different fixes. Carry what the provider
                        # actually said, sanitized like any other value that
                        # reaches a log line from outside.
                        logged_finish_reason = _safe_log_token(
                            finish_reason or "unavailable",
                        )
                        if (
                            attempt < settings.llm_max_attempts
                            and _can_retry_within_budget(
                                request_started_at,
                                0.0,
                            )
                        ):
                            logger.warning(
                                "[LLM Service] outcome=retry "
                                "provider=%s model=%s reason=%s "
                                "finish_reason=%s "
                                "attempt=%s max_attempts=%s",
                                provider,
                                model_name,
                                fallback_reason,
                                logged_finish_reason,
                                attempt,
                                settings.llm_max_attempts,
                            )
                            continue
                        # Every other exhausted path logs `no_answer`; this one
                        # broke silently, so the last attempt's finish_reason
                        # was the one never recorded anywhere.
                        logger.warning(
                            "[LLM Service] outcome=no_answer "
                            "provider=%s model=%s reason=%s "
                            "finish_reason=%s attempts=%s",
                            provider,
                            model_name,
                            fallback_reason,
                            logged_finish_reason,
                            attempts,
                        )
                        break
                    fallback_reason = f"http_{response.status}"
                    break
            except urllib.error.HTTPError as error:
                fallback_reason = f"http_{error.code}"
                error_code = _extract_safe_error_code(error)
                request_id = _safe_log_token(
                    error.headers.get("x-request-id")
                    or error.headers.get("x-goog-request-id")
                    or "unavailable",
                )
                should_retry = _is_retryable_http_error(
                    error.code,
                    error_code,
                )
                if (
                    should_retry
                    and attempt < settings.llm_max_attempts
                ):
                    delay = retry_delay_seconds(
                        error,
                        attempt,
                    )
                    if _can_retry_within_budget(
                        request_started_at,
                        delay,
                    ):
                        logger.warning(
                            "[LLM Service] outcome=retry "
                            "provider=%s model=%s status=%s "
                            "error_code=%s request_id=%s "
                            "attempt=%s max_attempts=%s "
                            "delay_ms=%s",
                            provider,
                            model_name,
                            error.code,
                            error_code or "unavailable",
                            request_id,
                            attempt,
                            settings.llm_max_attempts,
                            round(delay * 1000),
                        )
                        time.sleep(delay)
                        continue

                logger.warning(
                    "[LLM Service] outcome=no_answer "
                    "provider=%s "
                    "model=%s status=%s error_code=%s "
                    "request_id=%s attempts=%s",
                    provider,
                    model_name,
                    error.code,
                    error_code or "unavailable",
                    request_id,
                    attempt,
                )
                break
            except TimeoutError as error:
                fallback_reason = type(error).__name__
                max_timeout_attempts = min(
                    settings.llm_max_attempts,
                    2,
                )
                if attempt < max_timeout_attempts:
                    delay = _backoff_delay_seconds(attempt)
                    if _can_retry_within_budget(
                        request_started_at,
                        delay,
                    ):
                        logger.warning(
                            "[LLM Service] outcome=retry "
                            "provider=%s model=%s error_type=%s "
                            "attempt=%s max_attempts=%s "
                            "delay_ms=%s",
                            provider,
                            model_name,
                            fallback_reason,
                            attempt,
                            max_timeout_attempts,
                            round(delay * 1000),
                        )
                        time.sleep(delay)
                        continue

                logger.warning(
                    "[LLM Service] outcome=no_answer "
                    "provider=%s "
                    "model=%s error_type=%s attempts=%s",
                    provider,
                    model_name,
                    fallback_reason,
                    attempt,
                )
                break
    except Exception as error:
        fallback_reason = type(error).__name__
        logger.warning(
            "[LLM Service] outcome=no_answer provider=%s "
            "model=%s error_type=%s",
            provider,
            model_name,
            fallback_reason,
        )

    return None, attempts, fallback_reason


def _remaining_retry_budget(request_started_at: float) -> float:
    elapsed = time.monotonic() - request_started_at
    return max(0.0, settings.llm_retry_budget_seconds - elapsed)


def _can_retry_within_budget(
    request_started_at: float,
    delay: float,
) -> bool:
    remaining_after_delay = (
        _remaining_retry_budget(request_started_at) - delay
    )
    return (
        remaining_after_delay
        >= settings.llm_min_retry_window_seconds
    )


def _extract_safe_error_code(error: urllib.error.HTTPError) -> str:
    try:
        body = error.read()
        parsed = json.loads(body.decode("utf-8"))
        error_payload = parsed.get("error", {})
        candidates = (
            error_payload.get("code"),
            error_payload.get("type"),
            error_payload.get("status"),
        )
        for candidate in candidates:
            if isinstance(candidate, str) and candidate:
                return _safe_log_token(candidate.lower())
    except (AttributeError, UnicodeDecodeError, json.JSONDecodeError):
        pass
    return ""


def _is_retryable_http_error(status: int, error_code: str) -> bool:
    if status == 429 and error_code in NON_RETRYABLE_QUOTA_CODES:
        return False
    return status in {408, 429} or 500 <= status <= 599


def retry_delay_seconds(
    error: urllib.error.HTTPError,
    attempt: int,
) -> float:
    retry_after = _parse_retry_after(
        error.headers.get("Retry-After"),
    )
    return _backoff_delay_seconds(attempt, retry_after)


def _backoff_delay_seconds(
    attempt: int,
    retry_after: float | None = None,
) -> float:
    exponential_delay = (
        settings.llm_retry_base_delay_seconds
        * (2 ** (attempt - 1))
    )
    delay = (
        retry_after
        if retry_after is not None
        else exponential_delay
    )
    delay += random.uniform(
        0.0,
        settings.llm_retry_jitter_seconds,
    )
    return min(delay, settings.llm_retry_max_delay_seconds)


def _parse_retry_after(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            retry_at = parsedate_to_datetime(value)
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            return max(
                0.0,
                (retry_at - datetime.now(timezone.utc)).total_seconds(),
            )
        except (TypeError, ValueError, OverflowError):
            return None


def _safe_log_token(value: object) -> str:
    return "".join(
        character
        for character in str(value)[:128]
        if character.isalnum() or character in "._:-"
    ) or "unavailable"
