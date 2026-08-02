import logging

from src.agents.node_support import _effective_contract_version
from src.agents.state import AnalyticsState
from src.config import settings
from src.schemas.analytics_output import encode_locked
from src.schemas.canonical import CanonicalAnalysisInput


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
        return {
            **state,
            "safety_status": "privacy_locked",
            "final_payload": encode_locked(
                CanonicalAnalysisInput.from_round_data(round_data),
                _effective_contract_version(round_data),
                privacy_threshold=privacy_threshold,
            ),
        }

    return {
        **state,
        "safety_status": "pass_privacy",
    }
