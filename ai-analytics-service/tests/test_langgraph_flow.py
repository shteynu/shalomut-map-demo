import pytest
from src.agents.graph import analytics_graph
from src.agents.state import AnalyticsState
from src.mcp_client.mock_server import mock_mcp_server

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
    assert final_payload["isLocked"] is False
    assert "stones" in final_payload
    assert len(final_payload["stones"]) == 8
    
    balance_stone = final_payload["stones"].get("balance")
    assert balance_stone is not None
    assert balance_stone["status"] == "red"
    assert len(balance_stone["recommendedInterventions"]) > 0

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
