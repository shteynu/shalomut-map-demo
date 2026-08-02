"""A provider that answers every dimension, with no network and no key.

Pipeline tests used to reach the end of a round by leaving the API key unset:
the failed call quietly became deterministic copy and the round still came out
`success`. A round the model could not write now fails, so a test that wants to
exercise the pipeline has to supply the answers.

The copy is the service's own aggregate-grounded sentence. That keeps the
safety validator meaningful here — real Hebrew about the real numbers of the
round — while only its origin is a stub. Green dimensions keep the production
rule that never calls a provider for them.
"""

from contextlib import ExitStack, contextmanager
from unittest.mock import patch

from src.config import settings
from src.services.llm_provider import (
    InterpretationGeneration,
    llm_provider_service,
)

# Bound before any patching, so the two calls below reach the real methods
# instead of recursing into the stubs that replace them.
_REAL_INTERPRETATION = (
    llm_provider_service.generate_psychological_interpretation_result
)
_REAL_SUMMARY = llm_provider_service.generate_overall_summary


def _answer_dimension(
    *,
    dim_id,
    dim_hebrew,
    score,
    status,
    retry_tier="fast",
    question_aggregates=None,
    background_context=None,
    contract_version="4.0",
    all_dimension_scores=None,
    repair_critique=None,
):
    if settings.only_llm_for_problematic and status == "green":
        return _REAL_INTERPRETATION(
            dim_id=dim_id,
            dim_hebrew=dim_hebrew,
            score=score,
            status=status,
            retry_tier=retry_tier,
            question_aggregates=question_aggregates,
            background_context=background_context,
            contract_version=contract_version,
            all_dimension_scores=all_dimension_scores,
            repair_critique=repair_critique,
        )

    return InterpretationGeneration(
        text=llm_provider_service._heuristic_fallback(
            dim_hebrew,
            score,
            status,
            llm_provider_service._normalize_question_aggregates(
                dim_id,
                question_aggregates,
            ),
        ),
        outcome="llm",
        attempts=1,
    )


def _answer_summary(
    *,
    dim_scores,
    background_context=None,
    retry_tier="fast",
    contract_version="4.0",
    question_aggregates=None,
    repair_critique=None,
):
    # Below 5.0 this text is written by the service anyway, so asking for it
    # under that version is the shortest route to a summary the validators
    # accept.
    return _REAL_SUMMARY(
        dim_scores=dim_scores,
        background_context=background_context,
        retry_tier=retry_tier,
        contract_version="4.0",
        question_aggregates=question_aggregates,
        repair_critique=repair_critique,
    )


@contextmanager
def answering_llm_provider():
    """Patch both model-written calls for the duration of the block."""
    with ExitStack() as stack:
        stack.enter_context(
            patch.object(
                llm_provider_service,
                "generate_psychological_interpretation_result",
                _answer_dimension,
            ),
        )
        stack.enter_context(
            patch.object(
                llm_provider_service,
                "generate_overall_summary",
                _answer_summary,
            ),
        )
        yield
