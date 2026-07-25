import pytest
from src.agents.nodes import privacy_gate_node
from src.agents.graph import analytics_graph
from src.agents.state import AnalyticsState
from src.contracts import AI_ANALYTICS_CONTRACT_VERSION
from src.schemas.mcp_types import RoundAnalyticsResult
from src.services.llm_provider import llm_provider_service

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
    assert "סף הפרטיות" in result["final_payload"]["errorMessage"]

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


def test_privacy_gate_uses_the_round_specific_threshold():
    below_custom_threshold = {
        "round_data": {
            "roundId": "custom-threshold-locked",
            "totalResponses": 12,
            "privacyThreshold": 15,
            "isLocked": False,
            "dimensionScores": {},
        },
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }
    above_custom_threshold = {
        **below_custom_threshold,
        "round_data": {
            **below_custom_threshold["round_data"],
            "roundId": "custom-threshold-unlocked",
            "totalResponses": 8,
            "privacyThreshold": 5,
        },
    }

    assert privacy_gate_node(below_custom_threshold)["safety_status"] == (
        "privacy_locked"
    )
    assert privacy_gate_node(above_custom_threshold)["safety_status"] == (
        "pass_privacy"
    )


@pytest.mark.asyncio
async def test_locked_v2_short_circuits_provider_and_exposes_no_details(
    monkeypatch,
):
    normalized = RoundAnalyticsResult.from_dict(
        {
            "contractVersion": AI_ANALYTICS_CONTRACT_VERSION,
            "roundId": "locked-v2",
            "totalResponses": 9,
            "privacyThreshold": 10,
            "isLocked": True,
            "dimensionScores": {
                "balance": {
                    "dimensionId": "balance",
                    "averageScore": 90,
                    "computedStatus": "green",
                },
            },
            "questionAggregates": {
                "balance-1": {
                    "questionId": "balance-1",
                    "dimensionId": "balance",
                    "questionTextHebrew": "פרט שאסור להעביר.",
                    "averageScore": 90,
                    "responseCount": 9,
                },
            },
            "calculatedAt": "2026-07-25T12:00:00Z",
        },
    )
    calls = []

    def fail_if_called(*_args, **_kwargs):
        calls.append(True)
        raise AssertionError("provider must not run for locked input")

    monkeypatch.setattr(
        llm_provider_service,
        "generate_psychological_interpretation_result",
        fail_if_called,
    )
    state = {
        "round_data": normalized.model_dump(),
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }

    final_state = await analytics_graph.ainvoke(state)
    payload = final_state["final_payload"]

    assert calls == []
    assert normalized.dimensionScores == {}
    assert normalized.questionAggregates == {}
    assert payload["contractVersion"] == AI_ANALYTICS_CONTRACT_VERSION
    assert payload["status"] == "locked_error"
    assert "stones" not in payload
    assert "overallPsychologicalSummary" not in payload
