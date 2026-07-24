import asyncio
import json
import os
import sys
import unittest
from unittest.mock import patch

# Add project src directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.schemas.mcp_types import RoundAnalyticsResult, RoundDimensionScore
from src.schemas.webhook import WebhookEventPayload
from src.mcp_client.mock_server import mock_mcp_server
from src.rag.store import LocalInterventionVectorStore
from src.agents.nodes import privacy_gate_node, agent_psychologist_node, agent_rag_intervention_node, agent_safety_validator_node
from src.agents.graph import analytics_graph
from src.agents.state import AnalyticsState
from src.contracts import (
    AI_ANALYTICS_CONTRACT_VERSION,
    AI_ANALYTICS_DIMENSION_IDS,
)
from src.config import settings
from src.mcp_client.client import MCPClientManager

class TestShalomutAIService(unittest.TestCase):
    
    def test_01_privacy_gate_locked(self):
        state: AnalyticsState = {
            "round_data": {
                "roundId": "locked-test-round",
                "totalResponses": 3,
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
        res = privacy_gate_node(state)
        self.assertEqual(res["safety_status"], "privacy_locked")
        self.assertEqual(res["final_payload"]["status"], "locked_error")
        self.assertTrue("Privacy lock active" in res["final_payload"]["errorMessage"])
        print("✔ Test 1 Passed: Privacy Gate correctly blocks locked round (<10 responses).")

    def test_02_privacy_gate_unlocked(self):
        state: AnalyticsState = {
            "round_data": {
                "roundId": "unlocked-test-round",
                "totalResponses": 25,
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
        res = privacy_gate_node(state)
        self.assertEqual(res["safety_status"], "pass_privacy")
        print("✔ Test 2 Passed: Privacy Gate passes valid unlocked round.")

    def test_03_rag_store_query(self):
        store = LocalInterventionVectorStore(kb_path="data/interventions_kb.json")
        interventions = store.get_interventions_for_dimension("balance", "red", limit=3)
        self.assertGreater(len(interventions), 0)
        self.assertTrue(any("ISO 45003" in i.source or "OECD" in i.source for i in interventions))
        print(f"✔ Test 3 Passed: Intervention catalog retrieved {len(interventions)} OECD/ISO45003 interventions.")

    def test_04_mock_mcp_server(self):
        res = mock_mcp_server.get_round_analytics("round-unlocked-sample")
        self.assertFalse(res.isLocked)
        self.assertEqual(res.totalResponses, 24)
        self.assertEqual(
            set(res.dimensionScores.keys()),
            set(AI_ANALYTICS_DIMENSION_IDS),
        )
        print("✔ Test 4 Passed: Mock Data Layer MCP Server provides complete round analytics schema.")

    def test_05_graph_style_async_execution(self):
        async def run_async_test():
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
            self.assertEqual(final_payload["status"], "success")
            self.assertEqual(
                final_payload["contractVersion"],
                AI_ANALYTICS_CONTRACT_VERSION,
            )
            self.assertIn("stones", final_payload)
            self.assertEqual(
                set(final_payload["stones"].keys()),
                set(AI_ANALYTICS_DIMENSION_IDS),
            )
            print("✔ Test 5 Passed: Async graph-style workflow executed end-to-end successfully.")

        asyncio.run(run_async_test())

    def test_06_rag_covers_every_canonical_dimension(self):
        store = LocalInterventionVectorStore(kb_path="data/interventions_kb.json")

        for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
            interventions = store.get_interventions_for_dimension(
                dimension_id,
                "red",
                limit=1,
            )
            self.assertGreater(len(interventions), 0)
            self.assertEqual(interventions[0].dimensionId, dimension_id)

        print("✔ Test 6 Passed: Intervention catalog covers every canonical dimension.")

    def test_07_remote_mcp_failure_does_not_fallback_to_mock_data(self):
        async def run_async_test():
            previous_use_mock = settings.use_mock_mcp
            settings.use_mock_mcp = False
            client = MCPClientManager("https://data-layer.example/api/mcp")

            try:
                with patch(
                    "urllib.request.urlopen",
                    side_effect=OSError("offline"),
                ):
                    with self.assertRaises(RuntimeError):
                        await client.fetch_round_analytics("round-real")
            finally:
                settings.use_mock_mcp = previous_use_mock

        asyncio.run(run_async_test())
        print("✔ Test 7 Passed: Remote MCP failures fail closed.")

if __name__ == "__main__":
    unittest.main()
