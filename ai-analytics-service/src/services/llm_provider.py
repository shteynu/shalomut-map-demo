"""What the service asks a model for, and what it does with the answer.

The three seams this file used to hold in one class now live next door:

- `llm_transport` — one bounded conversation with a provider;
- `hebrew_prompts` — the Hebrew this service composes itself;
- `hebrew_validation` — what counts as acceptable copy about a round.

`LLMProviderService` stays as the facade over them: it decides which model tier
a call gets, which prompt goes out, which predicate judges the answer, and what
a refused answer means for the round. Callers keep importing
`llm_provider_service` from here, including `nodes.py`, which reaches for the
validation half on text no provider ever returned.
"""

from dataclasses import dataclass
import logging
from typing import Any, Dict, Iterable, Literal, Optional, Tuple
import urllib.error

from src.config import settings
from src.services import hebrew_prompts, hebrew_validation
from src.services.hebrew_validation import _LATIN_PATTERN  # noqa: F401
from src.services.llm_transport import (
    ProviderUnavailableError,
    complete_with_retries,
    resolve_endpoint,
    retry_delay_seconds,
)

logger = logging.getLogger(__name__)

__all__ = [
    "AdaptedIntervention",
    "InterpretationGeneration",
    "LLMProviderService",
    "ProviderUnavailableError",
    "QuestionSuggestion",
    "llm_provider_service",
]


@dataclass(frozen=True)
class InterpretationGeneration:
    text: str
    outcome: Literal["llm", "deterministic_fallback"]
    attempts: int

    @property
    def retry_count(self) -> int:
        return max(0, self.attempts - 1)


@dataclass(frozen=True)
class QuestionSuggestion:
    """One draft questionnaire item, and how many attempts it took.

    There is no `outcome` field on purpose. An interpretation may legitimately be
    written by this service (the green dimension), so its provenance has to say
    which happened; a suggestion is either the model's or it does not exist. The
    template library Core already holds is the other source, and Core labels it
    as the template it is rather than passing it off as a suggestion.
    """

    text: str
    attempts: int


@dataclass(frozen=True)
class AdaptedIntervention:
    """One catalog entry rewritten for one school, or the catalog text itself."""

    summary: str
    actionable_steps: list[str]
    outcome: Literal["llm", "deterministic_fallback"]
    attempts: int


def _record_refusal(
    candidate: str,
    finish_reason: object,
    sink: list[hebrew_validation.AdaptationRefusal],
    *,
    expected_steps_per_entry: list[int],
    status: str,
    distribution_counts: Optional[set[str]] = None,
) -> hebrew_validation.AdaptationRefusal:
    """Judge one adaptation batch and remember why it was turned away.

    The transport takes a yes or no and logs `invalid_semantic_output` for
    every no, which is the same word for a missing separator and for a number
    written out as a word. The reason is kept here so the fallback line can
    name it, with the shape it saw.
    """
    if finish_reason != "stop":
        sink[0] = hebrew_validation.AdaptationRefusal(
            f"finish_{finish_reason}",
        )
        return sink[0]

    sink[0] = hebrew_validation.adaptation_batch_refusal(
        candidate,
        expected_steps_per_entry=expected_steps_per_entry,
        status=status,
        distribution_counts=distribution_counts,
    )
    return sink[0]


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
        as transport retries; when the budget is spent without an acceptable
        answer the call raises ``ProviderUnavailableError`` rather than
        inventing copy.

        Green is the one status allowed a deterministic interpretation, and it
        arrives by two roads. ``ONLY_LLM_FOR_PROBLEMATIC`` skips the provider
        entirely — no call, so no failure to hide. With the switch off, green is
        asked like every other dimension and falls back to the same sentence if
        the answer never comes: it is derived from the aggregates, it is the copy
        green had for as long as it was never asked, and taking it away would
        leave a strength blank. ``attempts`` separates the two roads — ``0`` was
        never asked, anything higher was asked and refused — and neither wears
        the ``llm`` label. Yellow and red have no such sentence: there the
        fallback would be a guess about a problem, so they raise instead.
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
                "את/ה פסיכולוג/ית ארגוני/ת תמציתי/ת עבור צוותי חינוך. "
                "ענה תמיד בעברית בלבד."
            ),
            model_name=model_name,
            is_acceptable=lambda candidate, finish_reason: (
                hebrew_validation.is_valid_provider_output(
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

        if status == "green":
            logger.warning(
                "[LLM Service] outcome=deterministic_fallback provider=%s "
                "model=%s reason=%s attempts=%s dimension=%s",
                provider,
                model_name,
                fallback_reason,
                attempts,
                dim_id,
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

        logger.warning(
            "[LLM Service] outcome=provider_unavailable provider=%s "
            "model=%s reason=%s attempts=%s dimension=%s",
            provider,
            model_name,
            fallback_reason,
            attempts,
            dim_id,
        )
        raise ProviderUnavailableError(
            fallback_reason,
            dimension_id=dim_id,
            attempts=attempts,
        )

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
        # Contracts 1.0-4.0 never ask the model for this text: it is a counted
        # statement about the round, written here by design. 5.0 does ask, and
        # there this sentence is not a safety net — see below.
        deterministic_summary = (
            f"הניתוח המצרפי מציג {yellow_red_count} ממדים הדורשים "
            f"תשומת לב ולצדם {green_count} חוזקות לשימור. "
            "כל המסקנות נשענות על נתונים מצרפיים מעל סף הפרטיות."
        )

        if contract_version != "5.0":
            return deterministic_summary

        model_name = self._model_for_tier(retry_tier)
        text, attempts, fallback_reason = self._complete_with_retries(
            build_prompt=lambda: self._build_overall_summary_prompt(
                dim_scores,
                question_aggregates,
                background_context,
            ),
            system_prompt=(
                "את/ה פסיכולוג/ית ארגוני/ת המסכם/ת רווחת צוות בבית ספר. "
                "ענה תמיד בעברית בלבד."
            ),
            model_name=model_name,
            is_acceptable=lambda candidate, finish_reason: (
                finish_reason == "stop"
                and self.is_hebrew_only_copy(candidate)
                and 2 <= len(self._sentences(candidate)) <= 4
            ),
        )
        if text is None:
            logger.warning(
                "[LLM Service] outcome=provider_unavailable model=%s "
                "reason=%s attempts=%s scope=overall_summary",
                model_name,
                fallback_reason,
                attempts,
            )
            raise ProviderUnavailableError(fallback_reason)
        return text

    def suggest_question_result(
        self,
        *,
        dimension_id: str,
        dimension_hebrew: str,
        existing_texts: Iterable[str] = (),
        retry_tier: str = "fast",
    ) -> QuestionSuggestion:
        """Draft one more questionnaire item for one dimension.

        The only call in this service that is not about a round: it carries no
        respondent data and no aggregates, because a questionnaire is built
        before anybody has answered it. It answers a manager who is waiting, so
        it is synchronous — one request through the same paced transport as
        everything else, which is what keeps a manager clicking twice from
        spending the round's quota.

        A refusal raises rather than returning a sentence this service wrote.
        Core has a template library for that case and says which one the manager
        is looking at; copy invented here and labelled as a suggestion would be
        the fallback wearing the label of the model again.
        """
        model_name = self._model_for_tier(retry_tier)
        existing = [text for text in existing_texts if text and text.strip()]
        text, attempts, fallback_reason = self._complete_with_retries(
            build_prompt=lambda: hebrew_prompts.question_suggestion_prompt(
                dimension_id=dimension_id,
                dimension_hebrew=dimension_hebrew,
                existing_texts=existing,
            ),
            system_prompt=(
                "את/ה מומחה/ית לבניית שאלוני רווחה לצוותי חינוך. "
                "ענה תמיד בעברית בלבד."
            ),
            model_name=model_name,
            is_acceptable=lambda candidate, finish_reason: (
                finish_reason == "stop"
                and hebrew_validation.is_valid_question_suggestion(
                    candidate,
                    existing,
                )
            ),
        )
        if text is None:
            logger.warning(
                "[LLM Service] outcome=provider_unavailable model=%s "
                "reason=%s attempts=%s scope=question_suggestion dimension=%s",
                model_name,
                fallback_reason,
                attempts,
                dimension_id,
            )
            raise ProviderUnavailableError(
                fallback_reason,
                dimension_id=dimension_id,
                attempts=attempts,
            )

        logger.info(
            "[LLM Service] outcome=llm model=%s attempts=%s "
            "scope=question_suggestion dimension=%s",
            model_name,
            attempts,
            dimension_id,
        )
        return QuestionSuggestion(text=text, attempts=attempts)

    def adapt_interventions_result(
        self,
        *,
        interventions: list[Dict[str, Any]],
        dim_hebrew: str,
        score: float,
        status: str,
        question_aggregates: Iterable[Dict[str, Any]] | None = None,
        background_context: Optional[Dict[str, Any]] = None,
        retry_tier: str = "fast",
    ) -> list[AdaptedIntervention]:
        """Rewrite every catalog entry of one dimension in a single request.

        The rewrite and its refusal rules are unchanged; what changes is that
        a dimension costs one request instead of one per entry. The free
        provider tier allows twenty requests a day against a round that used
        to want thirty-three, and the entries of a dimension all speak to the
        identical aggregates, status and school, so the repetition bought
        nothing. The per-entry path it replaces is gone rather than kept
        beside it: two adaptation prompts where only one is ever sent is how
        the one nobody exercises drifts.

        The coarser failure is deliberate and visible: a batch the validators
        refuse leaves every entry of that dimension on its catalog text, where
        one entry alone would have failed before. The fallback is copy a human
        wrote, so a school reads something true either way — but it is a wider
        blast radius, and `adaptationOutcome` still records which it got.
        """
        entries = list(interventions)
        aggregates = list(question_aggregates or [])
        catalog = [
            (
                str(intervention.get("summary", "")),
                [
                    str(step)
                    for step in intervention.get("actionable_steps", [])
                ],
            )
            for intervention in entries
        ]

        def catalog_result(attempts: int) -> list[AdaptedIntervention]:
            return [
                AdaptedIntervention(
                    summary=summary,
                    actionable_steps=steps,
                    outcome="deterministic_fallback",
                    attempts=attempts,
                )
                for summary, steps in catalog
            ]

        # An entry without copy to rewrite has nothing to send, and mixing it
        # into the batch would make the block count disagree with the answer.
        if not entries or any(
            not summary or not steps for summary, steps in catalog
        ):
            return catalog_result(0)

        expected_steps_per_entry = [len(steps) for _, steps in catalog]
        model_name = self._model_for_tier(retry_tier)
        distribution_counts = self.distribution_counts(aggregates)
        # Carries the last attempt's refusal out of the predicate, so the
        # fallback line can say which gate closed instead of leaving the
        # dimension to be reconstructed from the database later.
        refusal = [hebrew_validation.AdaptationRefusal()]
        text, attempts, fallback_reason = self._complete_with_retries(
            build_prompt=lambda: hebrew_prompts.adaptation_batch_prompt(
                interventions=entries,
                dim_hebrew=dim_hebrew,
                score=score,
                status=status,
                question_aggregates=aggregates,
                background_context=background_context,
            ),
            system_prompt=(
                "את/ה פסיכולוג/ית ארגוני/ת המתאים/ה המלצות מקטלוג לבית ספר "
                "אחד. ענה תמיד בעברית בלבד."
            ),
            model_name=model_name,
            is_acceptable=lambda candidate, finish_reason: (
                not _record_refusal(
                    candidate,
                    finish_reason,
                    refusal,
                    expected_steps_per_entry=expected_steps_per_entry,
                    status=status,
                    distribution_counts=distribution_counts,
                )
            ),
        )

        parsed = (
            hebrew_validation.parse_adaptation_batch(
                text,
                expected_steps_per_entry,
            )
            if text is not None
            else None
        )
        if parsed is None:
            logger.info(
                "[LLM Service] adaptation=deterministic_fallback model=%s "
                "reason=%s refusal=%s detail=[%s] dimension=%s "
                "attempts=%s entries=%s",
                model_name,
                fallback_reason,
                refusal[0].label or "unavailable",
                refusal[0].detail,
                entries[0].get("dimensionId") or "unavailable",
                attempts,
                len(entries),
            )
            return catalog_result(attempts)

        return [
            AdaptedIntervention(
                summary=adapted_summary,
                actionable_steps=adapted_steps,
                outcome="llm",
                attempts=attempts,
            )
            for adapted_summary, adapted_steps in parsed
        ]

    @staticmethod
    def _model_for_tier(retry_tier: str) -> str:
        return (
            settings.llm_model_heavy
            if retry_tier == "heavy"
            else settings.llm_model_fast
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

    # The seams below are re-exposed as methods so that a caller — a test, the
    # graph, the safety validator — keeps reaching for one object rather than
    # learning which of the three modules a helper moved to.

    def _complete_with_retries(
        self,
        *,
        build_prompt,
        system_prompt: str,
        model_name: str,
        is_acceptable,
    ) -> Tuple[Optional[str], int, str]:
        return complete_with_retries(
            build_prompt=build_prompt,
            system_prompt=system_prompt,
            model_name=model_name,
            is_acceptable=is_acceptable,
        )

    def _resolve_endpoint(self, model_name: str) -> str:
        return resolve_endpoint(model_name)

    def _retry_delay_seconds(
        self,
        error: urllib.error.HTTPError,
        attempt: int,
    ) -> float:
        return retry_delay_seconds(error, attempt)

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
        return hebrew_prompts.interpretation_prompt(
            dim_id=dim_id,
            dim_hebrew=dim_hebrew,
            score=score,
            status=status,
            question_aggregates=question_aggregates,
            background_context=background_context,
            contract_version=contract_version,
            all_dimension_scores=all_dimension_scores,
        )

    def _build_overall_summary_prompt(
        self,
        dim_scores: Dict[str, Any],
        question_aggregates: Iterable[Dict[str, Any]] | None = None,
        background_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        return hebrew_prompts.overall_summary_prompt(
            dim_scores,
            question_aggregates,
            background_context,
        )

    def _heuristic_fallback(
        self,
        dim_hebrew: str,
        score: float,
        status: str,
        question_aggregates: list[Dict[str, Any]] | None = None,
    ) -> str:
        return hebrew_prompts.heuristic_interpretation(
            dim_hebrew,
            score,
            status,
            question_aggregates,
        )

    @staticmethod
    def has_full_distribution(
        question_aggregates: Iterable[Dict[str, Any]] | None,
    ) -> bool:
        return hebrew_validation.has_full_distribution(question_aggregates)

    @staticmethod
    def distribution_counts(
        question_aggregates: Iterable[Dict[str, Any]] | None,
    ) -> Optional[set[str]]:
        return hebrew_validation.distribution_counts(question_aggregates)

    def is_complete_hebrew_copy(
        self,
        text: str,
        contract_version: str = "4.0",
    ) -> bool:
        return hebrew_validation.is_complete_hebrew_copy(
            text,
            contract_version=contract_version,
        )

    def is_hebrew_only_copy(self, text: str) -> bool:
        return hebrew_validation.is_hebrew_only_copy(text)

    def is_status_consistent(
        self,
        text: str,
        status: str,
        contract_version: str = "4.0",
        distribution_counts: Optional[set[str]] = None,
    ) -> bool:
        return hebrew_validation.is_status_consistent(
            text,
            status,
            contract_version=contract_version,
            distribution_counts=distribution_counts,
        )

    @staticmethod
    def _sentences(text: str) -> list[str]:
        return hebrew_validation.sentences(text)

    @staticmethod
    def _sanitize_model_text(text: str) -> str:
        return hebrew_validation.sanitize_model_text(text)


llm_provider_service = LLMProviderService()
