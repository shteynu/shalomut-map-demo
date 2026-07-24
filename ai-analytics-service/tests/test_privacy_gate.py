import pytest
from src.agents.nodes import privacy_gate_node
from src.agents.state import AnalyticsState

def test_privacy_gate_locked_round():
    """
    Verify that Privacy Gate halts execution when total responses < 10 or isLocked=True.
    """
    state: AnalyticsState = {
        "round_data": {
            "roundId": "test-locked-uuid",
            "totalResponses": 4,
            "privacyThreshold": 10,
            "isLocked": True,
            "dimensionScores": {}
        },
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {}
    }

    result = privacy_gate_node(state)
    assert result["safety_status"] == "privacy_locked"
    assert result["final_payload"]["status"] == "locked_error"
    assert "Privacy lock active" in result["final_payload"]["errorMessage"]

def test_privacy_gate_unlocked_round():
    """
    Verify that Privacy Gate passes when total responses >= 10 and isLocked=False.
    """
    state: AnalyticsState = {
        "round_data": {
            "roundId": "test-unlocked-uuid",
            "totalResponses": 18,
            "privacyThreshold": 10,
            "isLocked": False,
            "dimensionScores": {}
        },
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {}
    }

    result = privacy_gate_node(state)
    assert result["safety_status"] == "pass_privacy"
