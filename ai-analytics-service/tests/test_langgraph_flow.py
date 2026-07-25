import pytest
from src.agents.graph import analytics_graph
from src.agents.state import AnalyticsState
from src.config import settings
from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_QUESTIONS,
    AI_ANALYTICS_V1_CONTRACT_VERSION,
)
from src.mcp_client.mock_server import mock_mcp_server
from src.schemas.mcp_types import RoundAnalyticsResult


def create_v2_round_data():
    dimension_values = {
        dimension_id: (80 if index % 3 == 0 else 60 if index % 3 == 1 else 40)
        for index, dimension_id in enumerate(AI_ANALYTICS_DIMENSION_IDS)
    }
    return RoundAnalyticsResult.from_dict(
        {
            "contractVersion": AI_ANALYTICS_CONTRACT_VERSION,
            "roundId": "round-v2-semantic",
            "totalResponses": 12,
            "privacyThreshold": 10,
            "isLocked": False,
            "dimensionScores": {
                dimension_id: {
                    "dimensionId": dimension_id,
                    "averageScore": score,
                    "computedStatus": (
                        "green" if score >= 75 else "yellow" if score >= 50 else "red"
                    ),
                }
                for dimension_id, score in dimension_values.items()
            },
            "questionAggregates": {
                question["id"]: {
                    "questionId": question["id"],
                    "dimensionId": question["dimensionId"],
                    "questionTextHebrew": question["textHebrew"],
                    "averageScore": dimension_values[question["dimensionId"]],
                    "responseCount": 12,
                }
                for question in AI_ANALYTICS_QUESTIONS
            },
            "calculatedAt": "2026-07-25T12:00:00Z",
        },
    )

@pytest.mark.asyncio
async def test_langgraph_flow_unlocked():
    round_data = mock_mcp_server.get_round_analytics("round-unlocked-sample")
    
    initial_state: AnalyticsState = {
        "round_data": round_data.model_dump(),
        "org_context": round_data.organizationContext or {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {}
    }

    final_state = await analytics_graph.ainvoke(initial_state)
    final_payload = final_state.get("final_payload", {})

    assert final_payload["status"] == "success"
    assert final_payload["contractVersion"] == AI_ANALYTICS_V1_CONTRACT_VERSION
    assert final_payload["isLocked"] is False
    assert "stones" in final_payload
    assert len(final_payload["stones"]) == 8
    
    balance_stone = final_payload["stones"].get("balance")
    assert balance_stone is not None
    assert balance_stone["status"] == "red"
    assert len(balance_stone["recommendedInterventions"]) > 0


@pytest.mark.asyncio
async def test_langgraph_flow_v2_emits_question_metrics_and_provenance(
    monkeypatch,
):
    monkeypatch.setattr(settings, "llm_api_key", "")
    round_data = create_v2_round_data()
    initial_state: AnalyticsState = {
        "round_data": round_data.model_dump(),
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }

    final_state = await analytics_graph.ainvoke(initial_state)
    payload = final_state["final_payload"]

    assert payload["status"] == "success"
    assert payload["contractVersion"] == AI_ANALYTICS_CONTRACT_VERSION
    assert set(payload["stones"]) == set(AI_ANALYTICS_DIMENSION_IDS)
    for dimension_id, stone in payload["stones"].items():
        expected_question_ids = [
            question["id"]
            for question in AI_ANALYTICS_QUESTIONS
            if question["dimensionId"] == dimension_id
        ]
        assert [metric["questionId"] for metric in stone["metrics"]] == (
            expected_question_ids
        )
        assert all(
            intervention["status"] == stone["status"]
            for intervention in stone["recommendedInterventions"]
        )
        assert stone["generationProvenance"] == {
            "outcome": "deterministic_fallback",
            "attempts": 0,
            "retryCount": 0,
            "sourceQuestionIds": expected_question_ids,
        }

@pytest.mark.asyncio
async def test_langgraph_flow_locked():
    round_data = mock_mcp_server.get_round_analytics("round-locked-sample")

    initial_state: AnalyticsState = {
        "round_data": round_data.model_dump(),
        "org_context": round_data.organizationContext or {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {}
    }

    final_state = await analytics_graph.ainvoke(initial_state)
    final_payload = final_state.get("final_payload", {})

    assert final_payload["status"] == "locked_error"
    assert final_payload["isLocked"] is True
    assert "errorMessage" in final_payload
