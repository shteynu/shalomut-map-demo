"""One bounded conversation with a provider, and nothing about its content.

Every generation in the service goes through `complete_with_retries`, so no
second one can quietly get a weaker transport than the interpretations: same
attempt cap, retry budget, backoff, Retry-After handling, hard-quota rules, log
lines and place in the queue toward the provider. What counts as an acceptable
answer is the caller's business and arrives as a predicate — this module never
reads the Hebrew it carries.
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
from src.services.provider_rate_limit import provider_rate_limiter

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

    def __init__(
        self,
        reason: str,
        *,
        dimension_id: Optional[str] = None,
        attempts: int = 0,
    ):
        super().__init__(
            f"AI provider unavailable: {reason or 'provider_error'}"
        )
        self.reason = reason or "provider_error"
        self.dimension_id = dimension_id
        # How many attempts were spent before giving up. On 5.0 a single dead
        # dimension becomes a stone that says so, and its provenance has to
        # report the same attempt count a successful stone would.
        self.attempts = attempts


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
        # Every request this process sends passes through here, so this
        # is where the account's pace is charged — and it is charged before
        # the retry clock starts. Waiting for a turn is the rate limit's
        # business, not this call's budget; folding it in would leave a request
        # that waited its twelve seconds with no time left to be retried.
        provider_rate_limiter.wait()
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
                        retry_wait = (
                            _book_retry_send(request_started_at)
                            if attempt < settings.llm_max_attempts
                            else None
                        )
                        if retry_wait is not None:
                            logger.warning(
                                "[LLM Service] outcome=retry "
                                "provider=%s model=%s reason=%s "
                                "finish_reason=%s "
                                "attempt=%s max_attempts=%s "
                                "delay_ms=%s",
                                provider,
                                model_name,
                                fallback_reason,
                                logged_finish_reason,
                                attempt,
                                settings.llm_max_attempts,
                                round(retry_wait * 1000),
                            )
                            time.sleep(retry_wait)
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
                    # The retry a `429` deserves is one in the next
                    # window, not one in the window it was just refused in.
                    # Three attempts 0.5 and 1.1 seconds apart spent
                    # themselves inside the same exhausted minute and asked
                    # the same question three times.
                    retry_wait = _book_retry_send(
                        request_started_at,
                        retry_delay_seconds(error, attempt),
                    )
                    if retry_wait is not None:
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
                            round(retry_wait * 1000),
                        )
                        time.sleep(retry_wait)
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
                    retry_wait = _book_retry_send(
                        request_started_at,
                        _backoff_delay_seconds(attempt),
                    )
                    if retry_wait is not None:
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
                            round(retry_wait * 1000),
                        )
                        time.sleep(retry_wait)
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


def _book_retry_send(
    request_started_at: float,
    min_delay: float = 0.0,
) -> float | None:
    """Book the next attempt's turn, or refuse a wait the budget cannot hold.

    The pace and the retry budget are one decision rather than two. A retry
    that waits for its turn and only then finds the budget spent has burned
    the turn for nothing, so what the queue is allowed to quote is what remains
    of the budget once the next attempt keeps the minimum window it needs to be
    worth starting at all.

    Returns the seconds to wait before re-sending, or `None` to stop retrying.
    """
    return provider_rate_limiter.book(
        min_delay=min_delay,
        max_wait=(
            _remaining_retry_budget(request_started_at)
            - settings.llm_min_retry_window_seconds
        ),
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
    jitter = random.uniform(
        0.0,
        settings.llm_retry_jitter_seconds,
    )
    if retry_after is not None:
        # A number the provider sent is not ours to shorten. Capping a
        # thirty-second `Retry-After` at two seconds aims the next attempt at
        # the window that just refused it; `LLM_RETRY_MAX_DELAY_SECONDS` bounds
        # the backoff we invent, not the wait we were told to take. What bounds
        # this one is the retry budget, which declines a wait it cannot hold.
        return retry_after + jitter
    exponential_delay = (
        settings.llm_retry_base_delay_seconds
        * (2 ** (attempt - 1))
    )
    return min(
        exponential_delay + jitter,
        settings.llm_retry_max_delay_seconds,
    )


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
