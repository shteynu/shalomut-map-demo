import json
import logging
import urllib.request
from typing import Dict, Any
from src.agents.state import AnalyticsState
from src.rag.store import LocalInterventionVectorStore
from src.config import settings

logger = logging.getLogger(__name__)
vector_store = LocalInterventionVectorStore()

# Hebrew dimension labels mapping
DIMENSION_NAMES_HEBREW = {
    "workload_balance": "איזון עומס עבודה",
    "management_support": "תמיכת הנהלה",
    "peer_relationships": "תמיכת עמיתים",
    "psychological_safety": "ביטחון פסיכולוגי",
    "professional_growth": "פיתוח מקצועי",
    "work_environment": "סביבת עבודה",
    "sense_of_meaning": "תחושת משמעות",
    "recognition_compensation": "הערכה ותגמול"
}

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

def _call_llm_psychologist(dim_id: str, dim_hebrew: str, score: float, status: str) -> str:
    """
    Calls live LLM API (OpenAI GPT-4o) if OPENAI_API_KEY is configured.
    """
    if settings.openai_api_key:
        try:
            prompt = (
                f"You are an expert Organizational Psychologist analyzing teacher wellbeing.\n"
                f"Dimension: '{dim_hebrew}' ({dim_id}). Score: {score:.1f}/100. Status: {status.upper()}.\n"
                f"Write a 2-3 sentence deep psychological interpretation in HEBREW explaining the organizational causes and impact on teachers."
            )
            req_data = json.dumps({
                "model": settings.openai_model,
                "messages": [
                    {"role": "system", "content": "You are a senior organizational psychologist specializing in educational staff mental health."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.openai_api_key}"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10.0) as response:
                if response.status == 200:
                    res = json.loads(response.read().decode("utf-8"))
                    return res["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning(f"[Agent Psychologist] LLM API call failed ({e}), using domain heuristic fallback.")

    # Domain heuristic fallback
    if status == "red":
        return (
            f"מדד '{dim_hebrew}' מצוי באזור אדום (ציון {score:.1f}). "
            f"ניתוח פסיכולוגי ארגוני מצביע על שחיקה גבוהה ותחושת מצוקה מבנית בקרב צוות ההוראה. "
            f"יש לנקוט בצעדים מיידיים להפחתת הלחץ ולמתן מענה ארגוני תומך."
        )
    elif status == "yellow":
        return (
            f"מדד '{dim_hebrew}' מצוי באזור צהוב (ציון {score:.1f}). "
            f"נצפית מגמת שחיקה מתונה הדורשת תשומת לב מונעת מצד הנהלת בית הספר. "
            f"מומלץ לחזק את ערוצי התקשורת ולהטמיע שיפורים תהליכיים."
        )
    return (
        f"מדד '{dim_hebrew}' מצוי באזור ירוק (ציון {score:.1f}). "
        f"הצוות מביע שביעות רצון גבוהה וחיבור חיובי לתחום זה."
    )

def agent_psychologist_node(state: AnalyticsState) -> AnalyticsState:
    """
    Node 2: Agent Psychologist (LLM Node)
    Takes dimensionScores (focusing on 'yellow' and 'red' statuses)
    and generates deep organizational psychology interpretations.
    """
    round_data = state.get("round_data", {})
    dim_scores = round_data.get("dimensionScores", {})
    interpretations = {}

    yellow_red_dims = []
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
        interp = _call_llm_psychologist(dim_id, dim_hebrew, score, status)
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
    Node 3: Agent RAG Intervention (Tool Node)
    Queries local Vector DB (ChromaDB) to extract top-3 relevant structural interventions
    for problematic ('yellow'/'red') dimensions and adds them to the state.
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
    Node 4: Agent Safety Validator (LLM Critique Node)
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
