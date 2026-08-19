import asyncio
from typing import Any, Dict, NamedTuple, Optional

from src.agents.safety_report import SafetyViolationTarget, critique
from src.agents.state import AnalyticsState
from src.config import settings
from src.contracts import (
    AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
    AI_ANALYTICS_QUESTIONS,
    AI_ANALYTICS_V1_CONTRACT_VERSION,
)
from src.schemas.contract_registry import get_capabilities
from src.services import hebrew_validation


DIMENSION_NAMES_HEBREW = AI_ANALYTICS_DIMENSION_NAMES_HEBREW


def _provider_slots() -> asyncio.Semaphore:
    """Return one batch's bounded set of provider slots."""
    return asyncio.Semaphore(settings.llm_max_concurrent_requests)


async def _in_provider_slot(slots: asyncio.Semaphore, function, /, **kwargs):
    """Run one blocking provider call once a slot is free."""
    async with slots:
        return await asyncio.to_thread(function, **kwargs)


class ReplayPlan(NamedTuple):
    """The parts of a round a replay has to write again."""

    interpretations: frozenset[str]
    recommendations: frozenset[str]
    overall_summary: bool


def _replay_plan(state: AnalyticsState) -> Optional[ReplayPlan]:
    """Return the targeted plan, or ``None`` for a full pass.

    Two different things produce one. A replay writes again what the validator
    refused; a partial run writes again what a manager asked for. They are not
    the same event — nothing failed in the second — but the nodes need the same
    answer from both: which dimensions to write, and which already have copy
    worth keeping. So they share this, and the difference stays where it
    belongs, in what each one names.

    The round sentence is always in a partial plan. It is written from every
    dimension at once, so leaving last round's sentence over a rewritten
    dimension would be the one carried thing that is no longer true.
    """
    if state.get("retry_count", 0) <= 0:
        requested = frozenset(state.get("regenerate_dimension_ids") or ())
        if not requested:
            return None
        return ReplayPlan(
            interpretations=requested,
            recommendations=requested,
            overall_summary=True,
        )

    plan = ReplayPlan(
        interpretations=frozenset(
            state.get("retry_interpretation_dimensions") or (),
        ),
        recommendations=frozenset(
            state.get("retry_recommendation_dimensions") or (),
        ),
        overall_summary=bool(state.get("retry_overall_summary")),
    )
    if not (
        plan.interpretations
        or plan.recommendations
        or plan.overall_summary
    ):
        return None
    return plan


def _repair_critique(
    state: AnalyticsState,
    target: SafetyViolationTarget,
    dimension_id: Optional[str] = None,
) -> Optional[str]:
    """Return what to tell the model it got wrong last time, if anything.

    Only a replay carries one. A first pass has no violations, and a dimension
    the validator accepted is not regenerated at all, so the common answer here
    is ``None``.
    """
    if state.get("retry_count", 0) <= 0:
        return None
    return critique(
        state.get("safety_violations") or (),
        target,
        dimension_id,
    )


def _effective_contract_version(round_data: Dict[str, Any]) -> str:
    return round_data.get(
        "contractVersion",
        AI_ANALYTICS_V1_CONTRACT_VERSION,
    )


def _background_context_for_prompt(
    round_data: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Return school context only for contracts that declare the capability.

    The state's `org_context` is not a second source of it, which is why this
    no longer takes the state at all. The runner seeds that key with
    `{"organizationId": <uuid>}` on every round, because Core always sends it,
    so falling back to it made every round look as though a school had written
    something: `backgroundContextIncluded` read `True` on every 4.0+ round,
    while the manifest defines that flag as the inclusion of
    `RoundBackgroundContext`. The id never reached a reader — the interpretation
    prompt renders only the named background fields — so what the fallback
    bought was a provenance flag that could not say no.
    """
    contract_version = _effective_contract_version(round_data)
    if not get_capabilities(contract_version).supportsBackgroundContext:
        return None

    return round_data.get("backgroundContext") or None


def _question_aggregates_for_dimension(
    round_data: Dict[str, Any],
    dimension_id: str,
) -> list[Dict[str, Any]]:
    aggregates = round_data.get("questionAggregates", {})
    if get_capabilities(
        _effective_contract_version(round_data),
    ).supportsDynamicQuestions:
        return [
            aggregate
            for aggregate in aggregates.values()
            if aggregate.get("dimensionId") == dimension_id
        ]
    return [
        aggregates[question["id"]]
        for question in AI_ANALYTICS_QUESTIONS
        if question["dimensionId"] == dimension_id
        and question["id"] in aggregates
    ]


V5_PROMPT_INCLUSION_FIELDS = (
    "distributionIncluded",
    "crossDimensionContextIncluded",
)


def _v5_prompt_inclusions(
    round_data: Dict[str, Any],
    dimension_id: str,
    dim_scores: Dict[str, Any],
) -> Dict[str, bool]:
    """Measure which enriched inputs actually reached a 5.0 prompt."""
    return {
        "distributionIncluded": hebrew_validation.has_full_distribution(
            _question_aggregates_for_dimension(round_data, dimension_id),
        ),
        "crossDimensionContextIncluded": bool(dim_scores),
    }
