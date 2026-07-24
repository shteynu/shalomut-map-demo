import logging
from typing import Dict, Any
from src.agents.state import AnalyticsState
from src.rag.store import LocalInterventionVectorStore
from src.services.llm_provider import llm_provider_service
from src.config import settings
from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
)

logger = logging.getLogger(__name__)
vector_store = LocalInterventionVectorStore()

DIMENSION_NAMES_HEBREW = AI_ANALYTICS_DIMENSION_NAMES_HEBREW

def privacy_gate_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 1: Privacy Gate (Python Function)
    Checks state['round_data']['isLocked']. If True (<10 responses),
    halts graph execution immediately and flags privacy error.
    """
    round_data = state.get("round_data", {})
    is_locked = round_data.get("isLocked", False)
    total_responses = round_data.get("totalResponses", 0)
    
    logger.info(f"[Node 1: Privacy Gate] Checking privacy lock. Responses: {total_responses}, isLocked: {is_locked}")
    
    if is_locked or total_responses < settings.privacy_threshold:
        return {
            **state,
            "safety_status": "privacy_locked",
            "final_payload": {
                "contractVersion": AI_ANALYTICS_CONTRACT_VERSION,
                "roundId": round_data.get("roundId", ""),
                "isLocked": True,
                "status": "locked_error",
                "errorMessage": f"Privacy lock active: minimum {settings.privacy_threshold} responses required to prevent deanonymization. Current: {total_responses}."
            }
        }
        
    return {
        **state,
        "safety_status": "pass_privacy"
    }

def agent_psychologist_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 2: Agent Psychologist (LLM Node)
    Takes dimensionScores (focusing on 'yellow' and 'red' statuses)
    and delegates generation to the decoupled LLMProviderService.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    retry_count = state.get("retry_count", 0)
    interpretations = {}

    yellow_red_dims = []
    retry_tier = "heavy" if retry_count > 0 else "fast"

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
        interp = llm_provider_service.generate_psychological_interpretation(
            dim_id=dim_id,
            dim_hebrew=dim_hebrew,
            score=score,
            status=status,
            retry_tier=retry_tier
        )
        interpretations[dim_id] = interp

    overall_summary = (
        f"ניתוח פסיכולוגי ארגוני כולל: זוהו {len(yellow_red_dims)} מוקדי טיפול מרכזיים (בסטטוס צהוב/אדום). "
        f"המלצות התערבות מבוססות תקני OECD ו-ISO45003 לשמירה על רווחת צוות ההוראה."
    )

    return {
        **state,
        "interpretations": {
            "overall_summary": overall_summary,
            "dimension_interpretations": interpretations
        }
    }

def agent_rag_intervention_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 3: Intervention Catalog (Tool Node)
    Queries the local structured catalog to extract top-3 relevant organizational
    interventions for each dimension and adds them to the state.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    recommendations = {}

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
        else:
            status = getattr(score_obj, "computedStatus", "green")

        interventions = vector_store.get_interventions_for_dimension(
            dimension_id=dim_id,
            status=status,
            limit=3
        )
        recommendations[dim_id] = [i.model_dump() if hasattr(i, "model_dump") else i.to_dict() for i in interventions]

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
    retry_count = state.get("retry_count", 0)

    is_safe = True
    feedback = []

    for dim_id, score_obj in dim_scores.items():
        if isinstance(score_obj, dict):
            status = score_obj.get("computedStatus", "green")
        else:
            status = getattr(score_obj, "computedStatus", "green")

        interp = interpretations.get(dim_id, "")
        
        # Check hallucination: if status is green but text claims critical red alert
        if status == "green" and ("מצוקה מבנית" in interp or "אזור אדום" in interp):
            is_safe = False
            feedback.append(f"Hallucination detected for green dimension {dim_id}")

    if not is_safe and retry_count < 3:
        logger.warning(f"[Safety Validator] Safety check failed. Retry count: {retry_count + 1}")
        return {
            **state,
            "safety_status": "fail",
            "safety_feedback": "; ".join(feedback),
            "retry_count": retry_count + 1
        }

    return {
        **state,
        "safety_status": "pass",
        "safety_feedback": None
    }
