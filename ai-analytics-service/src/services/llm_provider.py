from datetime import datetime, timezone
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
import json
import logging
import random
import re
import time
from typing import Any, Dict, Iterable, Literal
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

_HEBREW_PATTERN = re.compile(r"[\u0590-\u05ff]")
_LATIN_PATTERN = re.compile(r"[A-Za-z]")
_COMPLETE_SENTENCE_PATTERN = re.compile(r"[^.!?؟]+[.!?؟]")


@dataclass(frozen=True)
class InterpretationGeneration:
    text: str
    outcome: Literal["llm", "deterministic_fallback"]
    attempts: int

    @property
    def retry_count(self) -> int:
        return max(0, self.attempts - 1)


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
        retry_tier: str = "fast",
        question_aggregates: Iterable[Dict[str, Any]] | None = None,
    ) -> str:
        return self.generate_psychological_interpretation_result(
            dim_id=dim_id,
            dim_hebrew=dim_hebrew,
            score=score,
            status=status,
            retry_tier=retry_tier,
            question_aggregates=question_aggregates,
        ).text

    def generate_psychological_interpretation_result(
        self,
        dim_id: str,
        dim_hebrew: str,
        score: float,
        status: str,
        retry_tier: str = "fast",
        question_aggregates: Iterable[Dict[str, Any]] | None = None,
    ) -> InterpretationGeneration:
        """
        Generate a semantically validated interpretation and auditable outcome.

        Provider output is accepted only when the provider reports a complete
        response (``finish_reason=stop``), the copy is Hebrew-only, contains
        exactly two complete sentences, and does not contradict the numerical
        status. Invalid output uses the same bounded attempt and time budgets
        as transport retries before falling back to deterministic aggregate
        copy.
        """
        questions = self._normalize_question_aggregates(
            dim_id,
            question_aggregates,
        )

        if settings.only_llm_for_problematic and status == "green":
            logger.info(
                "[LLM Service] outcome=deterministic_fallback "
                "provider=skipped reason=green_token_optimization "
                "attempts=0"
            )
            return InterpretationGeneration(
                text=self._heuristic_fallback(
                    dim_hebrew,
                    score,
                    status,
                    questions,
                ),
                outcome="deterministic_fallback",
                attempts=0,
            )

        model_name = (
            settings.llm_model_heavy
            if retry_tier == "heavy"
            else settings.llm_model_fast
        )
        provider = settings.resolved_llm_provider(model_name)
        fallback_reason = "missing_api_key"
        attempts = 0

        if settings.llm_api_key:
            try:
                endpoint = self._resolve_endpoint(model_name)
                prompt = self._build_prompt(
                    dim_id=dim_id,
                    dim_hebrew=dim_hebrew,
                    score=score,
                    status=status,
                    question_aggregates=questions,
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
                                "[LLM Service] "
                                "outcome=deterministic_fallback "
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
                                    result = content.strip()
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
                                if self._is_valid_provider_output(
                                    result,
                                    finish_reason,
                                    status,
                                ):
                                    logger.info(
                                        "[LLM Service] outcome=llm "
                                        "provider=%s model=%s attempt=%s",
                                        provider,
                                        model_name,
                                        attempt,
                                    )
                                    return InterpretationGeneration(
                                        text=result,
                                        outcome="llm",
                                        attempts=attempts,
                                    )

                                if fallback_reason != "invalid_provider_response":
                                    fallback_reason = (
                                        "invalid_finish_reason"
                                        if finish_reason != "stop"
                                        else "invalid_semantic_output"
                                    )
                                if (
                                    attempt < settings.llm_max_attempts
                                    and self._can_retry_within_budget(
                                        request_started_at,
                                        0.0,
                                    )
                                ):
                                    logger.warning(
                                        "[LLM Service] outcome=retry "
                                        "provider=%s model=%s reason=%s "
                                        "attempt=%s max_attempts=%s",
                                        provider,
                                        model_name,
                                        fallback_reason,
                                        attempt,
                                        settings.llm_max_attempts,
                                    )
                                    continue
                                break
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
                            "[LLM Service] outcome=deterministic_fallback "
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
                            "[LLM Service] outcome=deterministic_fallback "
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
                    "[LLM Service] outcome=deterministic_fallback provider=%s "
                    "model=%s error_type=%s",
                    provider,
                    model_name,
                    fallback_reason,
                )

        logger.info(
            "[LLM Service] outcome=deterministic_fallback provider=%s "
            "model=%s reason=%s attempts=%s",
            provider,
            model_name,
            fallback_reason,
            attempts,
        )
        return InterpretationGeneration(
            text=self._heuristic_fallback(
                dim_hebrew,
                score,
                status,
                questions,
            ),
            outcome="deterministic_fallback",
            attempts=attempts,
        )

    def _build_prompt(
        self,
        dim_id: str,
        dim_hebrew: str,
        score: float,
        status: str,
        question_aggregates: list[Dict[str, Any]],
    ) -> str:
        uses_dynamic_questions = any(
            isinstance(aggregate.get("questionText"), str)
            for aggregate in question_aggregates
        )
        aggregate_lines = "\n".join(
            "".join(
                (
                    "- ",
                    (
                        f"[{aggregate['questionId']}] "
                        if uses_dynamic_questions
                        else ""
                    ),
                    f"{self._question_text(aggregate)} ",
                    f"ממוצע {aggregate['averageScore']:.1f}, ",
                    f"מספר תשובות {aggregate['responseCount']}",
                )
            )
            for aggregate in question_aggregates
        )
        return (
            "You are an organizational psychologist analyzing only "
            "privacy-safe teacher wellbeing aggregates.\n"
            f"Dimension: {dim_hebrew} ({dim_id}). "
            f"Score: {score:.1f}/100. Status: {status}.\n"
            f"{'Exact persisted' if uses_dynamic_questions else 'Canonical'} "
            f"same-dimension aggregates:\n{aggregate_lines}\n"
            "Return exactly two complete Hebrew-only sentences. Base every "
            "claim on the supplied aggregates, do not invent causes, "
            "diagnoses, identities, or respondent-level facts, and keep the "
            "interpretation consistent with the stated status."
        )

    def _normalize_question_aggregates(
        self,
        dim_id: str,
        question_aggregates: Iterable[Dict[str, Any]] | None,
    ) -> list[Dict[str, Any]]:
        if not question_aggregates:
            return []
        return [
            aggregate
            for aggregate in question_aggregates
            if aggregate.get("dimensionId") == dim_id
        ]

    @staticmethod
    def _question_text(aggregate: Dict[str, Any]) -> str:
        dynamic_text = aggregate.get("questionText")
        if isinstance(dynamic_text, str):
            return dynamic_text
        legacy_text = aggregate.get("questionTextHebrew")
        return legacy_text if isinstance(legacy_text, str) else ""

    def _is_valid_provider_output(
        self,
        text: str,
        finish_reason: object,
        status: str,
    ) -> bool:
        if finish_reason != "stop" or not self.is_complete_hebrew_copy(text):
            return False
        return self.is_status_consistent(text, status)

    def is_complete_hebrew_copy(self, text: str) -> bool:
        normalized = text.strip()
        if not self.is_hebrew_only_copy(normalized):
            return False
        sentences = _COMPLETE_SENTENCE_PATTERN.findall(normalized)
        compact_sentences = re.sub(r"\s", "", "".join(sentences))
        compact_text = re.sub(r"\s", "", normalized)
        return len(sentences) == 2 and compact_sentences == compact_text

    def is_hebrew_only_copy(self, text: str) -> bool:
        normalized = text.strip()
        return bool(
            normalized
            and _HEBREW_PATTERN.search(normalized)
            and not _LATIN_PATTERN.search(normalized)
        )

    def is_status_consistent(self, text: str, status: str) -> bool:
        contradictory_phrases = {
            "green": (
                "אדום",
                "צהוב",
                "מצוקה מבנית",
                "טיפול מיידי",
                "שחיקה",
                "לשפר",
                "שיפור",
            ),
            "yellow": (
                "אדום",
                "ירוק",
            ),
            "red": (
                "ירוק",
                "צהוב",
            ),
        }
        return not any(
            phrase in text
            for phrase in contradictory_phrases.get(status, ())
        )

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

    def _heuristic_fallback(
        self,
        dim_hebrew: str,
        score: float,
        status: str,
        question_aggregates: list[Dict[str, Any]] | None = None,
    ) -> str:
        aggregates = question_aggregates or []
        if aggregates:
            selected = (
                max(aggregates, key=lambda aggregate: aggregate["averageScore"])
                if status == "green"
                else min(
                    aggregates,
                    key=lambda aggregate: aggregate["averageScore"],
                )
            )
            question_text = self._question_text(selected)
            question_sentence = (
                question_text
                if re.search(r"[.!?؟]\s*$", question_text)
                else f"{question_text}."
            )
            aggregate_score = float(selected["averageScore"])
            score_text = (
                str(int(aggregate_score))
                if aggregate_score.is_integer()
                else f"{aggregate_score:.1f}"
            ).replace(".", ",")
            implication = {
                "green": "משקף חוזקה שכדאי לשמר לאורך זמן",
                "yellow": "מסמן תחום שכדאי לחזק באופן ממוקד",
                "red": "מסמן צורך בתשומת לב מיידית בתחום זה",
            }.get(status, "מציג את המצב המצרפי בתחום זה")
            return (
                f"השאלה המצרפית הבולטת במדד {dim_hebrew} היא: "
                f"{question_sentence} "
                f"ממוצע המענה עליה הוא {score_text} מתוך 100, והוא "
                f"{implication}."
            )

        score_text = (
            str(int(score))
            if float(score).is_integer()
            else f"{score:.1f}"
        ).replace(".", ",")
        if status == "red":
            return (
                f"מדד {dim_hebrew} נמצא באזור אדום עם ציון {score_text}. "
                "הנתון המצרפי מסמן צורך בתשומת לב מיידית בתחום זה."
            )
        if status == "yellow":
            return (
                f"מדד {dim_hebrew} נמצא באזור צהוב עם ציון {score_text}. "
                "הנתון המצרפי מסמן תחום שכדאי לחזק באופן ממוקד."
            )
        return (
            f"מדד {dim_hebrew} נמצא באזור ירוק עם ציון {score_text}. "
            "הנתון המצרפי משקף חוזקה שכדאי לשמר לאורך זמן."
        )

llm_provider_service = LLMProviderService()
