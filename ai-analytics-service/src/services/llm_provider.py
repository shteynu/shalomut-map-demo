from datetime import datetime, timezone
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
import json
import logging
import random
import re
import time
from typing import Any, Callable, Dict, Iterable, Literal, Optional, Tuple
import urllib.error
import urllib.request

from src.config import settings
from src.contracts import AI_ANALYTICS_DIMENSION_NAMES_HEBREW

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
_INTEGER_PATTERN = re.compile(r"\d+")

# Hebrew status words. On 5.0 the prompt states the score distribution in these
# very words, so naming another bucket can be plain reporting rather than a
# contradiction — see is_status_consistent.
_STATUS_WORDS_HEBREW = {
    "green": "ירוק",
    "yellow": "צהוב",
    "red": "אדום",
}
# "באזור אדום" / "בטווח אדום" is a verdict about the dimension, not a count.
_VERDICT_MARKERS_HEBREW = ("באזור", "בטווח")


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
        background_context: Optional[Dict[str, Any]] = None,
        contract_version: str = "4.0",
        all_dimension_scores: Optional[Dict[str, Any]] = None,
    ) -> str:
        return self.generate_psychological_interpretation_result(
            dim_id=dim_id,
            dim_hebrew=dim_hebrew,
            score=score,
            status=status,
            retry_tier=retry_tier,
            question_aggregates=question_aggregates,
            background_context=background_context,
            contract_version=contract_version,
            all_dimension_scores=all_dimension_scores,
        ).text

    def generate_psychological_interpretation_result(
        self,
        dim_id: str,
        dim_hebrew: str,
        score: float,
        status: str,
        retry_tier: str = "fast",
        question_aggregates: Iterable[Dict[str, Any]] | None = None,
        background_context: Optional[Dict[str, Any]] = None,
        contract_version: str = "4.0",
        all_dimension_scores: Optional[Dict[str, Any]] = None,
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

        model_name = self._model_for_tier(retry_tier)
        provider = settings.resolved_llm_provider(model_name)
        text, attempts, fallback_reason = self._complete_with_retries(
            build_prompt=lambda: self._build_prompt(
                dim_id=dim_id,
                dim_hebrew=dim_hebrew,
                score=score,
                status=status,
                question_aggregates=questions,
                background_context=background_context,
                contract_version=contract_version,
                all_dimension_scores=all_dimension_scores,
            ),
            system_prompt=(
                "You are a concise organizational psychologist for "
                "educational staff."
            ),
            model_name=model_name,
            is_acceptable=lambda candidate, finish_reason: (
                self._is_valid_provider_output(
                    candidate,
                    finish_reason,
                    status,
                    contract_version=contract_version,
                    distribution_counts=self.distribution_counts(questions),
                )
            ),
        )
        if text is not None:
            return InterpretationGeneration(
                text=text,
                outcome="llm",
                attempts=attempts,
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

    @staticmethod
    def _model_for_tier(retry_tier: str) -> str:
        return (
            settings.llm_model_heavy
            if retry_tier == "heavy"
            else settings.llm_model_fast
        )

    def _complete_with_retries(
        self,
        *,
        build_prompt: Callable[[], str],
        system_prompt: str,
        model_name: str,
        is_acceptable: Callable[[str, object], bool],
    ) -> Tuple[Optional[str], int, str]:
        """Run one bounded provider conversation and report what happened.

        Returns the accepted text (or None), how many attempts were made and
        the reason a caller has to fall back. Every generation goes through
        here, so a second one cannot quietly get a weaker transport than the
        interpretations: same attempt cap, retry budget, backoff, Retry-After
        handling, hard-quota rules and log lines.
        """
        provider = settings.resolved_llm_provider(model_name)
        attempts = 0
        if not settings.llm_api_key:
            return None, attempts, "missing_api_key"

        fallback_reason = "provider_error"
        try:
            endpoint = self._resolve_endpoint(model_name)
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

        return None, attempts, fallback_reason

    def generate_overall_summary(
        self,
        dim_scores: Dict[str, Any],
        background_context: Optional[Dict[str, Any]] = None,
        retry_tier: str = "fast",
        contract_version: str = "4.0",
        question_aggregates: Iterable[Dict[str, Any]] | None = None,
    ) -> str:
        yellow_red_count = sum(
            1
            for s in dim_scores.values()
            if (s.get("computedStatus") if isinstance(s, dict) else getattr(s, "computedStatus", "")) in ("yellow", "red")
        )
        green_count = len(dim_scores) - yellow_red_count
        fallback = (
            f"הניתוח המצרפי מציג {yellow_red_count} ממדים הדורשים "
            f"תשומת לב ולצדם {green_count} חוזקות לשימור. "
            "כל המסקנות נשענות על נתונים מצרפיים מעל סף הפרטיות."
        )

        if contract_version != "5.0":
            return fallback

        model_name = self._model_for_tier(retry_tier)
        text, _attempts, _fallback_reason = self._complete_with_retries(
            build_prompt=lambda: self._build_overall_summary_prompt(
                dim_scores,
                question_aggregates,
                background_context,
            ),
            system_prompt=(
                "You are an organizational psychologist summarizing school "
                "wellbeing."
            ),
            model_name=model_name,
            is_acceptable=lambda candidate, finish_reason: (
                finish_reason == "stop"
                and self.is_hebrew_only_copy(candidate)
                and 2
                <= len(_COMPLETE_SENTENCE_PATTERN.findall(candidate))
                <= 4
            ),
        )
        return text if text is not None else fallback

    def _build_overall_summary_prompt(
        self,
        dim_scores: Dict[str, Any],
        question_aggregates: Iterable[Dict[str, Any]] | None = None,
        background_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """The round-level picture: eight dimensions with their distributions.

        Score and status alone cannot separate "everyone answered yellow" from
        "half green, half red", which are different rounds to write about.
        """
        aggregates = list(question_aggregates or [])
        dim_lines = []
        for dimension_id, dimension_score in dim_scores.items():
            score_value = (
                dimension_score.get("averageScore", 0.0)
                if isinstance(dimension_score, dict)
                else getattr(dimension_score, "averageScore", 0.0)
            )
            status_value = (
                dimension_score.get("computedStatus", "")
                if isinstance(dimension_score, dict)
                else getattr(dimension_score, "computedStatus", "")
            )
            hebrew_name = AI_ANALYTICS_DIMENSION_NAMES_HEBREW.get(
                dimension_id,
                dimension_id,
            )
            line = (
                f"- {hebrew_name}: ציון {score_value:.1f}, "
                f"סטטוס {status_value}"
            )
            distribution = self._summed_distribution(
                aggregate
                for aggregate in aggregates
                if aggregate.get("dimensionId") == dimension_id
            )
            if distribution:
                line += (
                    f" (פיזור: {distribution['green']} ירוק / "
                    f"{distribution['yellow']} צהוב / "
                    f"{distribution['red']} אדום)"
                )
            dim_lines.append(line)

        background_lines = self._background_context_lines(background_context)
        background_section = (
            "\nSchool Background Context:\n" + "\n".join(background_lines)
            if background_lines
            else ""
        )

        return (
            "You are an organizational psychologist summarizing the overall "
            "teacher wellbeing picture of a school.\n"
            f"Dimension Scores:\n" + "\n".join(dim_lines) + "\n"
            f"{background_section}\n"
            "Return between 2 and 4 complete Hebrew-only sentences "
            "summarizing the overall state. Highlight key strengths and main "
            "priority areas, and use the distributions rather than the "
            "averages alone. Keep the tone professional, supportive, and "
            "grounded in the data; do not invent causes or diagnoses."
        )

    @staticmethod
    def _summed_distribution(
        question_aggregates: Iterable[Dict[str, Any]],
    ) -> Optional[Dict[str, int]]:
        totals = {"green": 0, "yellow": 0, "red": 0}
        seen = False
        for aggregate in question_aggregates:
            distribution = aggregate.get("scoreDistribution")
            if not isinstance(distribution, dict):
                continue
            for bucket in totals:
                count = distribution.get(bucket)
                if isinstance(count, int) and not isinstance(count, bool):
                    totals[bucket] += count
                    seen = True
        return totals if seen else None

    def _build_prompt(
        self,
        dim_id: str,
        dim_hebrew: str,
        score: float,
        status: str,
        question_aggregates: list[Dict[str, Any]],
        background_context: Optional[Dict[str, Any]] = None,
        contract_version: str = "4.0",
        all_dimension_scores: Optional[Dict[str, Any]] = None,
    ) -> str:
        uses_dynamic_questions = any(
            isinstance(aggregate.get("questionText"), str)
            for aggregate in question_aggregates
        )
        lines = []
        for aggregate in question_aggregates:
            prefix = f"[{aggregate['questionId']}] " if uses_dynamic_questions else ""
            dist_str = ""
            if contract_version == "5.0" and isinstance(aggregate.get("scoreDistribution"), dict):
                dist = aggregate["scoreDistribution"]
                dist_str = f" (תשובות: {dist.get('green', 0)} ירוק, {dist.get('yellow', 0)} צהוב, {dist.get('red', 0)} אדום)"
            lines.append(
                f"- {prefix}{self._question_text(aggregate)} ממוצע {aggregate['averageScore']:.1f}, מספר תשובות {aggregate['responseCount']}{dist_str}"
            )
        aggregate_lines = "\n".join(lines)

        bg_lines = self._background_context_lines(background_context)
        bg_section = ("\nSchool Background Context:\n" + "\n".join(bg_lines)) if bg_lines else ""

        cross_dim_section = ""
        if contract_version == "5.0" and isinstance(all_dimension_scores, dict) and all_dimension_scores:
            cd_lines = []
            for d_id, d_val in all_dimension_scores.items():
                s_val = d_val.get("averageScore", 0.0) if isinstance(d_val, dict) else getattr(d_val, "averageScore", 0.0)
                st_val = d_val.get("computedStatus", "") if isinstance(d_val, dict) else getattr(d_val, "computedStatus", "")
                d_heb = AI_ANALYTICS_DIMENSION_NAMES_HEBREW.get(d_id, d_id)
                cd_lines.append(f"- {d_heb} ({d_id}): ציון {s_val:.1f}, סטטוס {st_val}")
            cross_dim_section = "\nOverall 8-Dimension Context:\n" + "\n".join(cd_lines) + "\n"

        length_instruction = (
            "Return between 2 and 5 complete Hebrew-only sentences."
            if contract_version == "5.0"
            else "Return exactly two complete Hebrew-only sentences."
        )

        return (
            "You are an organizational psychologist analyzing only "
            "privacy-safe teacher wellbeing aggregates.\n"
            f"Dimension: {dim_hebrew} ({dim_id}). "
            f"Score: {score:.1f}/100. Status: {status}.{bg_section}\n"
            f"{cross_dim_section}"
            f"{'Exact persisted' if uses_dynamic_questions else 'Canonical'} "
            f"same-dimension aggregates:\n{aggregate_lines}\n"
            f"{length_instruction} Base every "
            "claim on the supplied aggregates, do not invent causes, "
            "diagnoses, identities, or respondent-level facts, and keep the "
            "interpretation consistent with the stated status."
        )

    @staticmethod
    def _background_context_lines(
        background_context: Optional[Dict[str, Any]],
    ) -> list[str]:
        """School-level context lines shared by every prompt that carries it."""
        if not isinstance(background_context, dict):
            return []

        lines = []
        if background_context.get("notes"):
            lines.append(f"הערות רקע מהמנהלת: {background_context['notes']}")
        if background_context.get("audience"):
            lines.append(f"קהל יעד: {background_context['audience']}")
        if background_context.get("studentCount"):
            lines.append(f"מספר תלמידים: {background_context['studentCount']}")
        if background_context.get("socioEconomicIndex"):
            lines.append(f"מדד טיפוח: {background_context['socioEconomicIndex']}")
        if background_context.get("newStaffMembers"):
            lines.append(f"צוות חדש: {background_context['newStaffMembers']}")
        if background_context.get("sicknessDaysThisQuarter"):
            lines.append(
                "ימי מחלה ברבעון: "
                f"{background_context['sicknessDaysThisQuarter']}"
            )
        classes = background_context.get("classesPerGrade")
        if isinstance(classes, dict) and classes:
            classes_str = ", ".join(
                f"שכבה {grade}: {count}"
                for grade, count in classes.items()
                if count
            )
            if classes_str:
                lines.append(f"כיתות: {classes_str}")
        return lines

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
        contract_version: str = "4.0",
        distribution_counts: Optional[set[str]] = None,
    ) -> bool:
        if finish_reason != "stop" or not self.is_complete_hebrew_copy(text, contract_version=contract_version):
            return False
        return self.is_status_consistent(
            text,
            status,
            contract_version=contract_version,
            distribution_counts=distribution_counts,
        )

    @staticmethod
    def has_full_distribution(
        question_aggregates: Iterable[Dict[str, Any]] | None,
    ) -> bool:
        """True when every aggregate of the dimension carries its buckets.

        `_build_prompt` renders the distribution per aggregate, so a dimension
        where one question lacks it reaches the model only partly enriched.
        """
        aggregates = list(question_aggregates or [])
        if not aggregates:
            return False
        for aggregate in aggregates:
            distribution = aggregate.get("scoreDistribution")
            if not isinstance(distribution, dict):
                return False
            for bucket in ("green", "yellow", "red"):
                count = distribution.get(bucket)
                if not isinstance(count, int) or isinstance(count, bool):
                    return False
        return True

    @staticmethod
    def distribution_counts(
        question_aggregates: Iterable[Dict[str, Any]] | None,
    ) -> Optional[set[str]]:
        """Counts a faithful 5.0 interpretation may quote for one dimension.

        The prompt lists every question's buckets, so those are the numbers the
        model can legitimately name; the per-bucket totals are added because
        summarising the dimension is just as faithful. None means no aggregate
        carried a distribution, and the flat 2.0-4.0 rule applies.
        """
        totals = {"green": 0, "yellow": 0, "red": 0}
        counts: set[str] = set()
        for aggregate in question_aggregates or []:
            distribution = aggregate.get("scoreDistribution")
            if not isinstance(distribution, dict):
                continue
            for bucket in totals:
                count = distribution.get(bucket)
                if isinstance(count, int) and not isinstance(count, bool):
                    totals[bucket] += count
                    counts.add(str(count))
        if not counts:
            return None
        return counts | {str(total) for total in totals.values()}

    def is_complete_hebrew_copy(self, text: str, contract_version: str = "4.0") -> bool:
        normalized = text.strip()
        if not self.is_hebrew_only_copy(normalized):
            return False
        sentences = _COMPLETE_SENTENCE_PATTERN.findall(normalized)
        compact_sentences = re.sub(r"\s", "", "".join(sentences))
        compact_text = re.sub(r"\s", "", normalized)
        expected_len = (2 <= len(sentences) <= 5) if contract_version == "5.0" else (len(sentences) == 2)
        return expected_len and compact_sentences == compact_text

    def is_hebrew_only_copy(self, text: str) -> bool:
        normalized = text.strip()
        return bool(
            normalized
            and _HEBREW_PATTERN.search(normalized)
            and not _LATIN_PATTERN.search(normalized)
        )

    def is_status_consistent(
        self,
        text: str,
        status: str,
        contract_version: str = "4.0",
        distribution_counts: Optional[set[str]] = None,
    ) -> bool:
        """Reject copy that contradicts the numerical status Core owns.

        Up to 4.0 the rule is a flat blacklist: naming any other status colour
        is a contradiction, because nothing in the prompt ever mentioned one.

        5.0 shows the LLM the score distribution in those very words and asks
        it to reason from them, so "12 answered yellow, 4 answered red" is a
        faithful report of a yellow dimension, not a contradiction. On 5.0 a
        foreign colour is therefore allowed only where it reads as a count —
        the sentence has to carry a number matching one of the buckets — and
        never as a verdict ("נמצא באזור אדום"). The judgement-style phrases
        stay blacklisted for every version.
        """
        judgement_phrases = {
            "green": (
                "מצוקה מבנית",
                "טיפול מיידי",
                "שחיקה",
                "לשפר",
                "שיפור",
            ),
        }
        if any(
            phrase in text
            for phrase in judgement_phrases.get(status, ())
        ):
            return False

        foreign_colours = [
            colour_word
            for colour_status, colour_word in _STATUS_WORDS_HEBREW.items()
            if colour_status != status
        ]
        if not foreign_colours:
            return True

        if contract_version != "5.0" or not distribution_counts:
            return not any(colour in text for colour in foreign_colours)

        for sentence in self._sentences_or_whole(text):
            for colour in foreign_colours:
                if colour not in sentence:
                    continue
                if any(
                    f"{marker} {colour}" in sentence
                    for marker in _VERDICT_MARKERS_HEBREW
                ):
                    return False
                if not (
                    set(_INTEGER_PATTERN.findall(sentence)) & distribution_counts
                ):
                    return False
        return True

    @staticmethod
    def _sentences_or_whole(text: str) -> list[str]:
        sentences = _COMPLETE_SENTENCE_PATTERN.findall(text)
        return sentences or [text]

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
