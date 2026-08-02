import asyncio

from src.agents.node_support import (
    DIMENSION_NAMES_HEBREW,
    _background_context_for_prompt,
    _effective_contract_version,
    _in_provider_slot,
    _provider_slots,
    _question_aggregates_for_dimension,
    _repair_critique,
    _replay_plan,
)
from src.agents.state import AnalyticsState
from src.rag.store import LocalInterventionVectorStore
from src.schemas.contract_registry import get_capabilities
from src.services.llm_provider import llm_provider_service


vector_store = LocalInterventionVectorStore()


def agent_rag_intervention_node(state: AnalyticsState) -> AnalyticsState:
    """Select status-scoped catalog interventions for each dimension."""
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    bg_context = _background_context_for_prompt(round_data, state)
    plan = _replay_plan(state)
    previous_recommendations = state.get("recommendations", {})
    recommendations = {}
    contract_version = _effective_contract_version(round_data)
    intervention_limit = (
        5
        if get_capabilities(contract_version).usesStructuredDimensionSummary
        else 3
    )

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
        else:
            status = getattr(score_obj, "computedStatus", "green")

        if (
            plan is not None
            and dim_id not in plan.recommendations
            and dim_id in previous_recommendations
        ):
            recommendations[dim_id] = previous_recommendations[dim_id]
            continue

        q_aggregates = _question_aggregates_for_dimension(round_data, dim_id)
        interventions = vector_store.get_interventions_for_dimension(
            dimension_id=dim_id,
            status=status,
            limit=intervention_limit,
            question_aggregates=q_aggregates,
            background_context=bg_context,
        )
        serialized_interventions = []
        for intervention in interventions:
            serialized = (
                intervention.model_dump()
                if hasattr(intervention, "model_dump")
                else intervention.to_dict()
            )
            serialized["status"] = status
            serialized_interventions.append(serialized)
        recommendations[dim_id] = serialized_interventions

    return {
        **state,
        "recommendations": recommendations,
    }


async def agent_adaptation_node(state: AnalyticsState) -> AnalyticsState:
    """Adapt selected interventions when the contract declares that output."""
    round_data = state.get("round_data", {})
    if not get_capabilities(
        _effective_contract_version(round_data),
    ).supportsAdaptationOutcome:
        return state

    dim_scores = round_data.get("dimensionScores", {})
    background_context = _background_context_for_prompt(round_data, state)
    retry_tier = "heavy" if state.get("retry_count", 0) > 0 else "fast"
    plan = _replay_plan(state)
    recommendations = state.get("recommendations", {})

    targets = []
    adaptations = []
    slots = _provider_slots()
    for dim_id, interventions in recommendations.items():
        if (
            plan is not None
            and dim_id not in plan.recommendations
            and all(
                intervention.get("adaptationOutcome")
                for intervention in interventions
            )
        ):
            continue

        score_obj = dim_scores.get(dim_id, {})
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = float(score_obj.get("averageScore", 0.0))
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = float(getattr(score_obj, "averageScore", 0.0))

        question_aggregates = _question_aggregates_for_dimension(
            round_data,
            dim_id,
        )
        targets.append((dim_id, len(interventions)))
        adaptation_kwargs = {
            "interventions": list(interventions),
            "dim_hebrew": DIMENSION_NAMES_HEBREW.get(dim_id, dim_id),
            "score": score,
            "status": status,
            "question_aggregates": question_aggregates,
            "background_context": background_context,
            "retry_tier": retry_tier,
            "repair_critique": _repair_critique(
                state,
                "recommendation",
                dim_id,
            ),
        }
        if get_capabilities(
            _effective_contract_version(round_data),
        ).usesStructuredDimensionSummary:
            adaptation_kwargs["contract_version"] = (
                _effective_contract_version(round_data)
            )
        adaptations.append(
            _in_provider_slot(
                slots,
                llm_provider_service.adapt_interventions_result,
                **adaptation_kwargs,
            )
        )

    results = await asyncio.gather(*adaptations)

    adapted = {
        dim_id: [dict(intervention) for intervention in interventions]
        for dim_id, interventions in recommendations.items()
    }
    for (dim_id, expected_count), dimension_adaptations in zip(
        targets,
        results,
    ):
        if len(dimension_adaptations) != expected_count:
            raise ValueError(
                "Adaptation count does not match the recommendations of "
                f"dimension {dim_id}"
            )
        for index, adaptation in enumerate(dimension_adaptations):
            adapted[dim_id][index].update(
                {
                    "summary": adaptation.summary,
                    "actionable_steps": list(adaptation.actionable_steps),
                    "adaptationOutcome": adaptation.outcome,
                },
            )

    return {
        **state,
        "recommendations": adapted,
    }
