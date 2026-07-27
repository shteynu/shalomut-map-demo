import asyncio
import logging
from typing import Dict, Any, Optional
from src.agents.state import AnalyticsState
from src.rag.store import LocalInterventionVectorStore
from src.services.llm_provider import llm_provider_service
from src.config import settings
from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_V4_CONTRACT_VERSION,
    AI_ANALYTICS_V5_CONTRACT_VERSION,
    AI_ANALYTICS_QUESTIONS,
    AI_ANALYTICS_V1_CONTRACT_VERSION,
)
from src.schemas.mcp_types import status_for_score

logger = logging.getLogger(__name__)
vector_store = LocalInterventionVectorStore()

DIMENSION_NAMES_HEBREW = AI_ANALYTICS_DIMENSION_NAMES_HEBREW


def _effective_contract_version(round_data: Dict[str, Any]) -> str:
    return round_data.get(
        "contractVersion",
        AI_ANALYTICS_V1_CONTRACT_VERSION,
    )


def _background_context_for_prompt(
    round_data: Dict[str, Any],
    state: "AnalyticsState",
) -> Optional[Dict[str, Any]]:
    """School background context reaches the prompt on contracts 4.0 and 5.0.

    Versions 1.0-3.0 are immutable boundaries: silently enriching their prompt
    would change what those versions mean without a version bump. 5.0 is 4.0
    plus score distributions, and Core sends the context on both
    (`src/app/api/mcp/route.ts`), so gating on 4.0 alone made an upgrade to
    5.0 trade the school context away for the distributions instead of adding
    them.
    """
    if _effective_contract_version(round_data) not in {
        AI_ANALYTICS_V4_CONTRACT_VERSION,
        AI_ANALYTICS_V5_CONTRACT_VERSION,
    }:
        return None

    return round_data.get("backgroundContext") or state.get("org_context")


def _question_aggregates_for_dimension(
    round_data: Dict[str, Any],
    dimension_id: str,
) -> list[Dict[str, Any]]:
    aggregates = round_data.get("questionAggregates", {})
    if _effective_contract_version(round_data) in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS:
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
    """What the 5.0 prompt actually carried for one dimension.

    These are measurements, not claims. Writing both flags as a constant True
    and then asserting they are True audits nothing: the pair exists so a
    reader of a stored result can tell an enriched interpretation from one the
    model produced without the distribution or the cross-dimension picture.
    """
    return {
        "distributionIncluded": llm_provider_service.has_full_distribution(
            _question_aggregates_for_dimension(round_data, dimension_id),
        ),
        "crossDimensionContextIncluded": bool(dim_scores),
    }


def privacy_gate_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 1: Privacy Gate (Python Function)
    Checks state['round_data']['isLocked']. If True (< privacyThreshold responses),
    halts graph execution immediately and flags privacy error.
    """
    round_data = state.get("round_data", {})
    is_locked = bool(round_data.get("isLocked", False))
    total_responses = int(round_data.get("totalResponses", 0))
    privacy_threshold = int(
        round_data.get("privacyThreshold", settings.privacy_threshold),
    )
    
    logger.info(f"[Node 1: Privacy Gate] Checking privacy lock. Responses: {total_responses}, isLocked: {is_locked}")
    
    if is_locked or total_responses < privacy_threshold:
        dynamic_metadata = (
            {
                "surveyDefinitionHash": round_data.get(
                    "surveyDefinitionHash",
                ),
            }
            if _effective_contract_version(round_data)
            == AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION
            else {}
        )
        return {
            **state,
            "safety_status": "privacy_locked",
            "final_payload": {
                "contractVersion": _effective_contract_version(round_data),
                "roundId": round_data.get("roundId", ""),
                **dynamic_metadata,
                "isLocked": True,
                "status": "locked_error",
                "errorMessage": (
                    "תוצאות מפורטות נעולות עד להשלמת סף הפרטיות "
                    f"של {privacy_threshold} משיבים."
                ),
            }
        }
        
    return {
        **state,
        "safety_status": "pass_privacy"
    }

async def agent_psychologist_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 2: Agent Psychologist (LLM Node)
    Takes dimensionScores (focusing on 'yellow' and 'red' statuses)
    and delegates generation to the decoupled LLMProviderService.

    The provider call is blocking, so dimensions run concurrently in worker
    threads. That keeps the event loop free and turns a per-dimension serial
    wait into a single round trip for the whole round.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    retry_count = state.get("retry_count", 0)

    yellow_red_dims = []
    retry_tier = "heavy" if retry_count > 0 else "fast"

    dim_ids = []
    generations = []

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = score_obj.get("averageScore", 0.0)
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = getattr(score_obj, "averageScore", 0.0)

        if status in ["yellow", "red"]:
            yellow_red_dims.append(dim_id)

        dim_hebrew = DIMENSION_NAMES_HEBREW.get(dim_id, dim_id)
        question_aggregates = _question_aggregates_for_dimension(
            round_data,
            dim_id,
        )
        background_context = _background_context_for_prompt(round_data, state)
        eff_version = _effective_contract_version(round_data)
        dim_ids.append(dim_id)
        generations.append(
            asyncio.to_thread(
                llm_provider_service.generate_psychological_interpretation_result,
                dim_id=dim_id,
                dim_hebrew=dim_hebrew,
                score=score,
                status=status,
                retry_tier=retry_tier,
                question_aggregates=question_aggregates,
                background_context=background_context,
                contract_version=eff_version,
                all_dimension_scores=dim_scores,
            )
        )

    generation_results = await asyncio.gather(*generations)
    interpretations = {
        dim_id: generation.text
        for dim_id, generation in zip(dim_ids, generation_results)
    }
    previous_provenance = state.get("generation_provenance", {})
    generation_provenance = {}
    eff_version = _effective_contract_version(round_data)
    for dim_id, generation in zip(dim_ids, generation_results):
        prior_attempts = int(
            previous_provenance.get(dim_id, {}).get("attempts", 0),
        )
        attempts = prior_attempts + generation.attempts
        source_question_ids = [
            aggregate["questionId"]
            for aggregate in _question_aggregates_for_dimension(
                round_data,
                dim_id,
            )
        ]
        generation_provenance[dim_id] = {
            "outcome": generation.outcome,
            "attempts": attempts,
            "retryCount": max(0, attempts - 1),
            "sourceQuestionIds": source_question_ids,
        }
        if eff_version in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS:
            generation_provenance[dim_id]["surveyDefinitionHash"] = (
                round_data.get("surveyDefinitionHash")
            )
        if eff_version in {
            AI_ANALYTICS_V4_CONTRACT_VERSION,
            AI_ANALYTICS_V5_CONTRACT_VERSION,
        }:
            generation_provenance[dim_id]["backgroundContextIncluded"] = bool(
                _background_context_for_prompt(round_data, state),
            )
        if eff_version == AI_ANALYTICS_V5_CONTRACT_VERSION:
            generation_provenance[dim_id].update(
                _v5_prompt_inclusions(round_data, dim_id, dim_scores),
            )

    background_context = _background_context_for_prompt(round_data, state)
    # Blocking provider call: the eight interpretations already run in worker
    # threads, and leaving this one on the event loop stalls the whole service
    # for the length of the round summary request.
    overall_summary = await asyncio.to_thread(
        llm_provider_service.generate_overall_summary,
        dim_scores=dim_scores,
        background_context=background_context,
        retry_tier=retry_tier,
        contract_version=eff_version,
        question_aggregates=list(
            round_data.get("questionAggregates", {}).values(),
        ),
    )

    return {
        **state,
        "interpretations": {
            "overall_summary": overall_summary,
            "dimension_interpretations": interpretations
        },
        "generation_provenance": generation_provenance,
    }

def agent_rag_intervention_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 3: Intervention Catalog (Tool Node)
    Queries the local structured catalog to extract top-3 relevant organizational
    interventions for each dimension and adds them to the state.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    bg_context = _background_context_for_prompt(round_data, state)
    recommendations = {}

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
        else:
            status = getattr(score_obj, "computedStatus", "green")

        q_aggregates = _question_aggregates_for_dimension(round_data, dim_id)
        interventions = vector_store.get_interventions_for_dimension(
            dimension_id=dim_id,
            status=status,
            limit=3,
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
        "recommendations": recommendations
    }

def agent_safety_validator_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 4: Agent Safety Validator (Critique Node)
    Acts as a quality controller. Checks combined text for AI hallucinations
    (e.g., claiming a score is bad when it's 'green') and privacy leaks.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    interpretations = state.get("interpretations", {}).get("dimension_interpretations", {})
    overall_summary = state.get("interpretations", {}).get(
        "overall_summary",
        "",
    )
    retry_count = state.get("retry_count", 0)
    contract_version = _effective_contract_version(round_data)
    is_semantic_contract = (
        contract_version in AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS
        and contract_version != AI_ANALYTICS_V1_CONTRACT_VERSION
    )
    is_dynamic_contract = contract_version in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS

    is_safe = True
    feedback = []

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
            score = float(score_obj.get("averageScore", 0.0))
        else:
            status = getattr(score_obj, "computedStatus", "green")
            score = float(getattr(score_obj, "averageScore", 0.0))

        interp = interpretations.get(dim_id, "")

        if status != status_for_score(score):
            is_safe = False
            feedback.append(
                f"Status is inconsistent with score for {dim_id}"
            )

        # The 5.0 prompt states the distribution in Hebrew colour words, so the
        # validator has to know which counts an interpretation may quote.
        distribution_counts = llm_provider_service.distribution_counts(
            _question_aggregates_for_dimension(round_data, dim_id),
        )
        if (
            not llm_provider_service.is_complete_hebrew_copy(
                interp,
                contract_version=contract_version,
            )
            or not llm_provider_service.is_status_consistent(
                interp,
                status,
                contract_version=contract_version,
                distribution_counts=distribution_counts,
            )
        ):
            is_safe = False
            feedback.append(
                f"Interpretation is invalid for status {status}: {dim_id}"
            )

        for intervention in state.get("recommendations", {}).get(
            dim_id,
            [],
        ):
            user_facing_copy = [
                intervention.get("title", ""),
                intervention.get("summary", ""),
                *intervention.get("actionable_steps", []),
            ]
            if (
                intervention.get("dimensionId") != dim_id
                or intervention.get("status") != status
                or not user_facing_copy
                or not all(
                    llm_provider_service.is_hebrew_only_copy(text)
                    for text in user_facing_copy
                )
            ):
                is_safe = False
                feedback.append(
                    f"Intervention is invalid for status {status}: {dim_id}"
                )

        if is_semantic_contract:
            provenance = state.get("generation_provenance", {}).get(
                dim_id,
                {},
            )
            expected_question_ids = [
                aggregate["questionId"]
                for aggregate in _question_aggregates_for_dimension(
                    round_data,
                    dim_id,
                )
            ]
            attempts = provenance.get("attempts")
            retry_count_value = provenance.get("retryCount")
            outcome = provenance.get("outcome")
            if (
                outcome not in {"llm", "deterministic_fallback"}
                or not isinstance(attempts, int)
                or isinstance(attempts, bool)
                or attempts < 0
                or not isinstance(retry_count_value, int)
                or isinstance(retry_count_value, bool)
                or retry_count_value != max(0, attempts - 1)
                or provenance.get("sourceQuestionIds")
                != expected_question_ids
                or (
                    is_dynamic_contract
                    and provenance.get("surveyDefinitionHash")
                    != round_data.get("surveyDefinitionHash")
                )
                or (outcome == "llm" and attempts < 1)
                or (
                    contract_version == AI_ANALYTICS_V5_CONTRACT_VERSION
                    and {
                        field: provenance.get(field)
                        for field in V5_PROMPT_INCLUSION_FIELDS
                    }
                    != _v5_prompt_inclusions(round_data, dim_id, dim_scores)
                )
            ):
                is_safe = False
                feedback.append(
                    f"Generation provenance is invalid for {dim_id}"
                )

    if is_semantic_contract and not llm_provider_service.is_hebrew_only_copy(
        overall_summary,
    ):
        is_safe = False
        feedback.append("Overall summary is not Hebrew-only")

    if not is_safe:
        next_retry_count = min(3, retry_count + 1)
        logger.warning(
            "[Safety Validator] Safety check failed. Retry count: %s",
            next_retry_count,
        )
        return {
            **state,
            "safety_status": "fail",
            "safety_feedback": "; ".join(feedback),
            "retry_count": next_retry_count,
        }

    return {
        **state,
        "safety_status": "pass",
        "safety_feedback": None
    }
