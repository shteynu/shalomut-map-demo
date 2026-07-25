from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import logging
import random
import time
import urllib.error
import urllib.request

from src.config import settings

logger = logging.getLogger(__name__)

NON_RETRYABLE_QUOTA_CODES = frozenset(
    {
        "billing_hard_limit_reached",
        "insufficient_quota",
        "quota_exceeded",
    },
)


class LLMProviderService:
    """
    Decoupled LLM Provider & Model Router Service.
    Encapsulates token economy rules, model tier selection (Fast vs Heavy),
    prompt construction, and provider API execution with graceful fallback.
    """

    def generate_psychological_interpretation(
        self, 
        dim_id: str, 
        dim_hebrew: str, 
        score: float, 
        status: str,
        retry_tier: str = "fast"
    ) -> str:
        """
        Generates psychological interpretation with strict token optimization:
        1. 0 Tokens on 'green' dimensions if `only_llm_for_problematic` is Enabled.
        2. Routes to fast model (gpt-4o-mini / claude-haiku) by default.
        3. Enforces strict max_tokens cap.
        4. Gracefully falls back to domain heuristics if API key is missing or offline.
        """
        # Token Optimization Rule: 0 tokens spent on healthy green dimensions
        if settings.only_llm_for_problematic and status == "green":
            logger.info(f"[LLM Service] Token Optimization: Skipped LLM call for green dimension '{dim_id}' (0 tokens).")
            return f"מדד '{dim_hebrew}' מצוי באזור ירוק (ציון {score:.1f}). הצוות מביע שביעות רצון גבוהה וחיבור חיובי לתחום זה."

        # Model Tier Selection
        model_name = (
            settings.llm_model_heavy
            if retry_tier == "heavy"
            else settings.llm_model_fast
        )
        provider = settings.resolved_llm_provider(model_name)
        fallback_reason = "missing_api_key"

        if settings.llm_api_key:
            try:
                endpoint = self._resolve_endpoint(model_name)
                prompt = (
                    f"You are an expert Organizational Psychologist analyzing teacher wellbeing.\n"
                    f"Dimension: '{dim_hebrew}' ({dim_id}). Score: {score:.1f}/100. Status: {status.upper()}.\n"
                    f"Write a concise 2-sentence psychological interpretation in HEBREW explaining organizational causes and impact."
                )
                req_payload = json.dumps({
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": "You are a concise organizational psychologist for educational staff."},
                        {"role": "user", "content": prompt}
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
                        remaining_budget = self._remaining_retry_budget(
                            request_started_at,
                        )
                        if remaining_budget < 0.1:
                            fallback_reason = "retry_budget_exhausted"
                            logger.warning(
                                "[LLM Service] outcome=heuristic "
                                "provider=%s model=%s reason=%s "
                                "attempts=%s",
                                provider,
                                model_name,
                                fallback_reason,
                                attempt - 1,
                            )
                            break
                        request_timeout = min(
                            settings.llm_request_timeout_seconds,
                            remaining_budget,
                        )
                        with urllib.request.urlopen(
                            req,
                            timeout=request_timeout,
                        ) as response:
                            if response.status == 200:
                                res = json.loads(
                                    response.read().decode("utf-8"),
                                )
                                result = (
                                    res["choices"][0]["message"]["content"]
                                    .strip()
                                )
                                logger.info(
                                    "[LLM Service] outcome=llm provider=%s "
                                    "model=%s attempt=%s",
                                    provider,
                                    model_name,
                                    attempt,
                                )
                                return result
                            fallback_reason = f"http_{response.status}"
                            break
                    except urllib.error.HTTPError as error:
                        fallback_reason = f"http_{error.code}"
                        error_code = self._extract_safe_error_code(error)
                        request_id = self._safe_log_token(
                            error.headers.get("x-request-id")
                            or error.headers.get("x-goog-request-id")
                            or "unavailable",
                        )
                        should_retry = self._is_retryable_http_error(
                            error.code,
                            error_code,
                        )
                        if (
                            should_retry
                            and attempt < settings.llm_max_attempts
                        ):
                            delay = self._retry_delay_seconds(
                                error,
                                attempt,
                            )
                            if self._can_retry_within_budget(
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
                            "[LLM Service] outcome=heuristic provider=%s "
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
                            delay = self._backoff_delay_seconds(attempt)
                            if self._can_retry_within_budget(
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
                            "[LLM Service] outcome=heuristic provider=%s "
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
                    "[LLM Service] outcome=heuristic provider=%s "
                    "model=%s error_type=%s",
                    provider,
                    model_name,
                    fallback_reason,
                )

        # Fallback Heuristic Generator
        logger.info(
            "[LLM Service] outcome=heuristic provider=%s model=%s reason=%s",
            provider,
            model_name,
            fallback_reason,
        )
        return self._heuristic_fallback(dim_hebrew, score, status)

    def _remaining_retry_budget(self, request_started_at: float) -> float:
        elapsed = time.monotonic() - request_started_at
        return max(0.0, settings.llm_retry_budget_seconds - elapsed)

    def _can_retry_within_budget(
        self,
        request_started_at: float,
        delay: float,
    ) -> bool:
        remaining_after_delay = (
            self._remaining_retry_budget(request_started_at) - delay
        )
        return (
            remaining_after_delay
            >= settings.llm_min_retry_window_seconds
        )

    def _extract_safe_error_code(
        self,
        error: urllib.error.HTTPError,
    ) -> str:
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
                    return self._safe_log_token(candidate.lower())
        except (AttributeError, UnicodeDecodeError, json.JSONDecodeError):
            pass
        return ""

    def _is_retryable_http_error(
        self,
        status: int,
        error_code: str,
    ) -> bool:
        if status == 429 and error_code in NON_RETRYABLE_QUOTA_CODES:
            return False
        return status in {408, 429} or 500 <= status <= 599

    def _retry_delay_seconds(
        self,
        error: urllib.error.HTTPError,
        attempt: int,
    ) -> float:
        retry_after = self._parse_retry_after(
            error.headers.get("Retry-After"),
        )
        return self._backoff_delay_seconds(attempt, retry_after)

    def _backoff_delay_seconds(
        self,
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

    def _parse_retry_after(self, value: str | None) -> float | None:
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

    def _safe_log_token(self, value: object) -> str:
        return "".join(
            character
            for character in str(value)[:128]
            if character.isalnum() or character in "._:-"
        ) or "unavailable"

    def _resolve_endpoint(self, model_name: str) -> str:
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

    def _heuristic_fallback(self, dim_hebrew: str, score: float, status: str) -> str:
        if status == "red":
            return (
                f"מדד '{dim_hebrew}' מצוי באזור אדום (ציון {score:.1f}). "
                f"ניתוח פסיכולוגי ארגוני מצביע על שחיקה גבוהה ותחושת מצוקה מבנית בקרב צוות ההוראה. "
                f"יש לנקוט בצעדים מיידיים להפחתת הלחץ ולמתן מענה ארגוני תומך."
            )
        elif status == "yellow":
            return (
                f"מדד '{dim_hebrew}' מצוי באזור צהוב (ציון {score:.1f}). "
                f"נצפית מגמת שחיקה מתונה הדורשת תשומת לב מונעת מצד הנהלת בית הספר. "
                f"מומלץ לחזק את ערוצי התקשורת ולהטמיע שיפורים תהליכיים."
            )
        return (
            f"מדד '{dim_hebrew}' מצוי באזור ירוק (ציון {score:.1f}). "
            f"הצוות מביע שביעות רצון גבוהה וחיבור חיובי לתחום זה."
        )

llm_provider_service = LLMProviderService()
