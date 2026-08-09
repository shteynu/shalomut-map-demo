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
    """Return the targeted replay plan, or ``None`` for a full pass."""
    if state.get("retry_count", 0) <= 0:
        return None

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
    """Return the round's school background context, and nothing else.

    This used to read `round_data["backgroundContext"] or state["org_context"]`.
    The second is the organization's identity, not the school's context, and
    the runner never leaves it empty — it always puts an `organizationId` in
    it. So from `4.0`, where the capability gate above first lets anything
    through, the `or` never fell through, and two things followed from that.

    A round whose school had filled in nothing still recorded
    `backgroundContextIncluded`, which the service README defines as context
    that *reaches the prompt*. Every deployed round on `4.0` and later reported
    `true`, so the flag could not tell a school that answered from one that did
    not.

    And on `6.0` the bare UUID reached the model. That is the one version where
    it could: `4.0` and `5.0` render the seven fields they know and silently
    ignore the rest, while the three `6.0` prompts JSON-dump this object whole.
    So the prompt half of the defect is `6.0`-only and the provenance half is
    not, which is why the test for it renders a prompt rather than reading a
    flag.

    Reading only `backgroundContext` fixes both at the root. It is the field
    the contract declares — `4.0` and `5.0` list its seven permitted keys —
    while `organizationContext`, the source `org_context` is built from, has no
    schema at all and Core's own MCP contract test asserts the payload never
    carries it. A local mock does send undeclared fields there; they now stop
    at the boundary instead of reaching a prompt that no manifest describes,
    which is the behaviour deployed rounds already had.

    Filtering the old fallback rather than removing it was tried and is worse:
    the only available measure is the seven-key line builder, which `6.0` does
    not use, so it would have erased fields that reach a `6.0` prompt today and
    let an org-level context override a round-level one that reported zeros.

    Nothing reads `org_context` after this. It stays in the state because the
    runner is tested on putting the organization's identity there; whether a
    record nobody reads should survive is a separate question from this one.
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
