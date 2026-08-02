import logging

from src.agents.node_support import _effective_contract_version
from src.agents.state import AnalyticsState
from src.config import settings
from src.schemas.contract_registry import get_capabilities


logger = logging.getLogger(__name__)


def privacy_gate_node(state: AnalyticsState) -> AnalyticsState:
    """Stop the graph before provider work when aggregate privacy is locked."""
    round_data = state.get("round_data", {})
    is_locked = bool(round_data.get("isLocked", False))
    total_responses = int(round_data.get("totalResponses", 0))
    privacy_threshold = int(
        round_data.get("privacyThreshold", settings.privacy_threshold),
    )

    logger.info(
        "[Node 1: Privacy Gate] Checking privacy lock. "
        "Responses: %s, isLocked: %s",
        total_responses,
        is_locked,
    )

    if is_locked or total_responses < privacy_threshold:
        dynamic_metadata = (
            {
                "surveyDefinitionHash": round_data.get(
                    "surveyDefinitionHash",
                ),
            }
            if get_capabilities(
                _effective_contract_version(round_data),
            ).supportsDynamicQuestions
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
            },
        }

    return {
        **state,
        "safety_status": "pass_privacy",
    }
