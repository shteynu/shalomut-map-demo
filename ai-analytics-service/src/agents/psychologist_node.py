import asyncio
import logging

from src.agents.node_support import (
    DIMENSION_NAMES_HEBREW,
    _background_context_for_prompt,
    _effective_contract_version,
    _in_provider_slot,
    _provider_slots,
    _question_aggregates_for_dimension,
    _repair_critique,
    _replay_plan,
    _v5_prompt_inclusions,
)
from src.agents.state import AnalyticsState
from src.application.ports import TextGenerator
from src.schemas.contract_registry import get_capabilities
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)


logger = logging.getLogger(__name__)


async def agent_psychologist_node(
    state: AnalyticsState,
    *,
    generator: TextGenerator = llm_provider_service,
) -> AnalyticsState:
    """Generate dimension interpretations, provenance and the round summary.

    The generator arrives from the graph. The default is the real provider, so
    a caller with nothing to say about it — a test exercising the node's own
    logic — keeps working unchanged.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    retry_count = state.get("retry_count", 0)
    plan = _replay_plan(state)
    previous_interpretations = state.get("interpretations", {}).get(
        "dimension_interpretations",
        {},
    )
    previous_provenance = state.get("generation_provenance", {})
    previous_summaries = state.get("interpretations", {}).get(
        "dimension_summaries",
        {},
    )
    previous_metric_insights = state.get("interpretations", {}).get(
        "metric_insights",
        {},
    )

    retry_tier = "heavy" if retry_count > 0 else "fast"
    if retry_count > 0:
        logger.info(
            "[Node 2: Psychologist] Replay %s on tier=%s writes %s",
            retry_count,
            retry_tier,
            "all"
            if plan is None
            else (
                "interpretations="
                + (",".join(sorted(plan.interpretations)) or "-")
                + " summary="
                + ("yes" if plan.overall_summary else "no")
            ),
        )

    dim_ids = []
    generations = []
    slots = _provider_slots()
    eff_version = _effective_contract_version(round_data)

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = score_obj.get("averageScore", 0.0)
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = getattr(score_obj, "averageScore", 0.0)

        if (
            plan is not None
            and dim_id not in plan.interpretations
            and dim_id in previous_provenance
        ):
            continue

        dim_hebrew = DIMENSION_NAMES_HEBREW.get(dim_id, dim_id)
        dimension_critique = _repair_critique(state, "interpretation", dim_id)
        question_aggregates = _question_aggregates_for_dimension(
            round_data,
            dim_id,
        )
        background_context = _background_context_for_prompt(round_data, state)
        dim_ids.append(dim_id)
        if get_capabilities(eff_version).usesStructuredDimensionSummary:
            generations.append(
                _in_provider_slot(
                    slots,
                    generator.generate_structured_summary_result,
                    dim_id=dim_id,
                    dim_hebrew=dim_hebrew,
                    status=status,
                    retry_tier=retry_tier,
                    question_aggregates=question_aggregates,
                    background_context=background_context,
                    contract_version=eff_version,
                    repair_critique=dimension_critique,
                )
            )
        else:
            generations.append(
                _in_provider_slot(
                    slots,
                    generator.generate_psychological_interpretation_result,
                    dim_id=dim_id,
                    dim_hebrew=dim_hebrew,
                    score=score,
                    status=status,
                    retry_tier=retry_tier,
                    question_aggregates=question_aggregates,
                    background_context=background_context,
                    contract_version=eff_version,
                    all_dimension_scores=dim_scores,
                    repair_critique=dimension_critique,
                )
            )

    settled = await asyncio.gather(*generations, return_exceptions=True)
    failures = [
        result
        for result in settled
        if isinstance(result, ProviderUnavailableError)
    ]
    for result in settled:
        if isinstance(result, BaseException) and not isinstance(
            result,
            ProviderUnavailableError,
        ):
            raise result

    regenerated = dict(zip(dim_ids, settled))
    structured = get_capabilities(eff_version).usesStructuredDimensionSummary
    interpretations = {}
    dimension_summaries = {}
    for dim_id in dim_scores:
        if dim_id not in regenerated:
            interpretations[dim_id] = previous_interpretations.get(dim_id, "")
            if structured and dim_id in previous_summaries:
                dimension_summaries[dim_id] = previous_summaries[dim_id]
            continue
        generation = regenerated[dim_id]
        if structured:
            interpretations[dim_id] = ""
            dimension_summaries[dim_id] = list(generation.paragraphs)
        else:
            interpretations[dim_id] = (
                "" if isinstance(generation, ProviderUnavailableError)
                else generation.text
            )

    eff_version = _effective_contract_version(round_data)
    partial_allowed = (
        get_capabilities(eff_version).supportsPartialMaps
        and any(interpretations.values())
    )

    if failures and not partial_allowed:
        logger.warning(
            "[Node 2: Psychologist] Provider unavailable for %s of %s "
            "dimension(s); first reason=%s dimension=%s",
            len(failures),
            len(dim_ids),
            failures[0].reason,
            failures[0].dimension_id,
        )
        return {
            **state,
            "safety_status": "provider_unavailable",
            "provider_failure_reason": failures[0].reason,
        }

    if failures:
        logger.warning(
            "[Node 2: Psychologist] Partial map: %s of %s dimension(s) have "
            "no interpretation; dimensions=%s reasons=%s",
            len(failures),
            len(dim_ids),
            ",".join(
                sorted(
                    failure.dimension_id or "unavailable"
                    for failure in failures
                ),
            ),
            ",".join(sorted({failure.reason for failure in failures})),
        )

    generation_provenance = {}
    for dim_id in dim_scores:
        if dim_id not in regenerated:
            generation_provenance[dim_id] = previous_provenance[dim_id]
            continue

        generation = regenerated[dim_id]
        prior_attempts = int(
            previous_provenance.get(dim_id, {}).get("attempts", 0),
        )
        attempts = prior_attempts + generation.attempts
        outcome = (
            "unavailable"
            if isinstance(generation, ProviderUnavailableError)
            else generation.outcome
        )
        source_question_ids = [
            aggregate["questionId"]
            for aggregate in _question_aggregates_for_dimension(
                round_data,
                dim_id,
            )
        ]
        generation_provenance[dim_id] = {
            "outcome": outcome,
            "attempts": attempts,
            "retryCount": max(0, attempts - 1),
            "sourceQuestionIds": source_question_ids,
        }
        if outcome == "unavailable":
            # The only cause that reaches here. Copy refused by the safety
            # loop becomes a gap much later, in the graph, and labels itself.
            generation_provenance[dim_id]["unavailableReason"] = (
                "provider_unavailable"
            )
        if get_capabilities(eff_version).supportsDynamicQuestions:
            generation_provenance[dim_id]["surveyDefinitionHash"] = (
                round_data.get("surveyDefinitionHash")
            )
        if get_capabilities(eff_version).supportsBackgroundContext:
            generation_provenance[dim_id]["backgroundContextIncluded"] = bool(
                _background_context_for_prompt(round_data, state),
            )
        if get_capabilities(eff_version).supportsScoreDistribution:
            generation_provenance[dim_id].update(
                _v5_prompt_inclusions(round_data, dim_id, dim_scores),
            )

    background_context = _background_context_for_prompt(round_data, state)
    metric_insights = dict(previous_metric_insights)
    if structured:
        metric_targets = []
        metric_generations = []
        metric_slots = _provider_slots()
        for dim_id, score_obj in dim_scores.items():
            if (
                plan is not None
                and dim_id not in plan.interpretations
                and dim_id in metric_insights
            ):
                continue
            status = (
                score_obj.get("computedStatus", "green")
                if isinstance(score_obj, dict)
                else getattr(score_obj, "computedStatus", "green")
            )
            metric_targets.append(dim_id)
            metric_generations.append(
                _in_provider_slot(
                    metric_slots,
                    generator.generate_metric_insights_result,
                    dim_id=dim_id,
                    dim_hebrew=DIMENSION_NAMES_HEBREW.get(dim_id, dim_id),
                    status=status,
                    retry_tier=retry_tier,
                    question_aggregates=_question_aggregates_for_dimension(
                        round_data,
                        dim_id,
                    ),
                    background_context=background_context,
                    contract_version=eff_version,
                    repair_critique=_repair_critique(
                        state,
                        "interpretation",
                        dim_id,
                    ),
                )
            )
        metric_results = await asyncio.gather(*metric_generations)
        metric_insights.update(
            {
                dim_id: result.insights
                for dim_id, result in zip(metric_targets, metric_results)
            },
        )
    previous_summary = state.get("interpretations", {}).get(
        "overall_summary",
        "",
    )
    keeps_summary = (
        plan is not None
        and not plan.overall_summary
        and bool(previous_summary)
    )
    try:
        overall_summary = previous_summary if keeps_summary else (
            await asyncio.to_thread(
                generator.generate_overall_summary,
                dim_scores=dim_scores,
                background_context=background_context,
                retry_tier=retry_tier,
                contract_version=eff_version,
                question_aggregates=list(
                    round_data.get("questionAggregates", {}).values(),
                ),
                repair_critique=_repair_critique(state, "overall_summary"),
            )
        )
    except ProviderUnavailableError as error:
        logger.warning(
            "[Node 2: Psychologist] Provider unavailable for the round "
            "summary; reason=%s",
            error.reason,
        )
        return {
            **state,
            "safety_status": "provider_unavailable",
            "provider_failure_reason": error.reason,
        }

    return {
        **state,
        "interpretations": {
            "overall_summary": overall_summary,
            "dimension_interpretations": interpretations,
            **(
                {
                    "dimension_summaries": dimension_summaries,
                    "metric_insights": metric_insights,
                }
                if structured
                else {}
            ),
        },
        "generation_provenance": generation_provenance,
    }
