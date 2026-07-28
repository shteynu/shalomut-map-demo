"""End-to-end service tests that used to live in `run_tests.py`.

They ran outside `pytest` and therefore outside `testpaths = ["tests"]`, so a
green `run_tests.py` said nothing about `tests/` — including the contract 5.0
suite. They are collected with everything else now; `run_tests.py` only
delegates to pytest.
"""

import asyncio
import json
import os
import unittest
from unittest.mock import AsyncMock, patch

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
    AI_ANALYTICS_V1_CONTRACT_VERSION,
)
from src.config import Settings, settings
from src.mcp_client.client import MCPClientManager, mcp_client_manager
from src.services.analytics_runner import analytics_runner_service

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
        self.assertIn("סף הפרטיות", res["final_payload"]["errorMessage"])
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
        self.assertRegex(interventions[0].title, r"[\u0590-\u05FF]")
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
                AI_ANALYTICS_V1_CONTRACT_VERSION,
            )
            self.assertIn("stones", final_payload)
            self.assertEqual(
                set(final_payload["stones"].keys()),
                set(AI_ANALYTICS_DIMENSION_IDS),
            )
            print("✔ Test 5 Passed: Async graph-style workflow executed end-to-end successfully.")

        asyncio.run(run_async_test())

    def test_06_rag_covers_every_canonical_dimension_and_status(self):
        store = LocalInterventionVectorStore(kb_path="data/interventions_kb.json")

        for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
            for status in ("green", "yellow", "red"):
                expected_ids = [
                    item["id"]
                    for item in store.raw_data
                    if item.get("dimension_id") == dimension_id
                    and status in item.get("target_status", [])
                ]
                self.assertGreater(
                    len(expected_ids),
                    0,
                    f"Missing {status} intervention for {dimension_id}",
                )

                interventions = store.get_interventions_for_dimension(
                    dimension_id,
                    status,
                    limit=len(store.raw_data),
                )
                self.assertEqual(
                    [item.id for item in interventions],
                    expected_ids,
                    f"Lookup crossed status boundary for {dimension_id}/{status}",
                )

        self.assertEqual(
            store.get_interventions_for_dimension("balance", "unknown"),
            [],
        )
        print("✔ Test 6 Passed: Intervention catalog has exact 8×3 status coverage without cross-status fallback.")

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

    def test_08_environment_defaults_to_production(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(Settings().env, "production")

        with patch.dict(os.environ, {"ENV": "development"}, clear=True):
            self.assertEqual(Settings().env, "development")

        print("✔ Test 8 Passed: Unset ENV defaults to production so the webhook secret stays mandatory.")

    def test_09_protection_bypass_travels_with_both_outbound_calls(self):
        """
        A core app behind Vercel Deployment Protection answers 302 to every
        anonymous request, so the MCP call and the callback must both carry the
        automation bypass whenever it is configured, and neither may leak it
        when it is not.
        """
        captured = []

        def capture_request(req, timeout=None):
            captured.append({
                name.lower(): value for name, value in req.headers.items()
            })
            raise OSError("captured before transport")

        async def collect_outbound_headers():
            client = MCPClientManager("https://data-layer.example/api/mcp")
            with patch("urllib.request.urlopen", side_effect=capture_request):
                with self.assertRaises(RuntimeError):
                    await client.fetch_round_analytics("round-bypass")
                with self.assertRaises(RuntimeError):
                    await analytics_runner_service._send_callback(
                        "https://data-layer.example/api/rounds/round-bypass/ai-insights",
                        {},
                    )

        previous_use_mock = settings.use_mock_mcp
        previous_bypass = settings.vercel_protection_bypass
        previous_callback_url = settings.data_layer_callback_url
        settings.use_mock_mcp = False
        try:
            settings.data_layer_callback_url = (
                "https://data-layer.example/api/rounds"
            )
            settings.vercel_protection_bypass = "bypass-token"
            asyncio.run(collect_outbound_headers())
            self.assertEqual(len(captured), 2)
            for headers in captured:
                self.assertEqual(
                    headers["x-vercel-protection-bypass"], "bypass-token"
                )

            captured.clear()
            settings.vercel_protection_bypass = ""
            asyncio.run(collect_outbound_headers())
            self.assertEqual(len(captured), 2)
            for headers in captured:
                self.assertNotIn("x-vercel-protection-bypass", headers)
        finally:
            settings.use_mock_mcp = previous_use_mock
            settings.vercel_protection_bypass = previous_bypass
            settings.data_layer_callback_url = previous_callback_url

        print("✔ Test 9 Passed: MCP and callback carry the Vercel automation bypass only when configured.")

    def test_10_protection_bypass_rejects_untrusted_callback_origin(self):
        """
        The project-wide bypass must never travel to a callback host supplied
        outside the configured Data Layer origin.
        """
        captured = []

        def capture_request(req, timeout=None):
            captured.append(req)
            raise OSError("transport should not be reached")

        async def send_untrusted_callback():
            with patch("urllib.request.urlopen", side_effect=capture_request):
                with self.assertRaisesRegex(
                    RuntimeError,
                    "Refusing callback outside the configured Data Layer origin",
                ):
                    await analytics_runner_service._send_callback(
                        "https://attacker.example/collect",
                        {},
                    )

        previous_bypass = settings.vercel_protection_bypass
        previous_callback_url = settings.data_layer_callback_url
        try:
            settings.vercel_protection_bypass = "bypass-token"
            settings.data_layer_callback_url = (
                "https://data-layer.example/api/rounds"
            )
            asyncio.run(send_untrusted_callback())
            self.assertEqual(captured, [])
        finally:
            settings.vercel_protection_bypass = previous_bypass
            settings.data_layer_callback_url = previous_callback_url

        print("✔ Test 10 Passed: Vercel bypass never leaves the configured callback origin.")

    def test_11_callback_rejects_untrusted_origin_without_vercel_bypass(self):
        """
        Callback authentication and analytics data must never travel to a
        payload-controlled origin, even when Vercel protection is disabled.
        """
        captured = []

        def capture_request(req, timeout=None):
            captured.append(req)
            raise OSError("transport should not be reached")

        async def send_untrusted_callback():
            with patch("urllib.request.urlopen", side_effect=capture_request):
                with self.assertRaisesRegex(
                    RuntimeError,
                    "Refusing callback outside the configured Data Layer origin",
                ):
                    await analytics_runner_service._send_callback(
                        "https://attacker.example/collect",
                        {"status": "success"},
                    )

        previous_bypass = settings.vercel_protection_bypass
        previous_callback_secret = settings.ai_callback_secret
        previous_callback_url = settings.data_layer_callback_url
        try:
            settings.vercel_protection_bypass = ""
            settings.ai_callback_secret = "callback-secret"
            settings.data_layer_callback_url = (
                "https://data-layer.example/api/rounds"
            )
            asyncio.run(send_untrusted_callback())
            self.assertEqual(captured, [])
        finally:
            settings.vercel_protection_bypass = previous_bypass
            settings.ai_callback_secret = previous_callback_secret
            settings.data_layer_callback_url = previous_callback_url

        print("✔ Test 11 Passed: Callback transport rejects every untrusted origin.")

    def test_12_mcp_post_uses_canonical_trailing_slash_url(self):
        captured = []

        def capture_request(req, timeout=None):
            captured.append(req)
            raise OSError("captured before transport")

        async def fetch_round():
            client = MCPClientManager("https://data-layer.example/api/mcp")
            with patch("urllib.request.urlopen", side_effect=capture_request):
                with self.assertRaises(RuntimeError):
                    await client.fetch_round_analytics("round-trailing-slash")

        previous_use_mock = settings.use_mock_mcp
        settings.use_mock_mcp = False
        try:
            asyncio.run(fetch_round())
            self.assertEqual(len(captured), 1)
            self.assertEqual(
                captured[0].full_url,
                "https://data-layer.example/api/mcp/",
            )
        finally:
            settings.use_mock_mcp = previous_use_mock

        print("✔ Test 12 Passed: MCP POST uses the canonical trailing-slash route.")

    def test_13_callback_post_uses_canonical_trailing_slash_url(self):
        async def process_round():
            round_data = mock_mcp_server.get_round_analytics(
                "round-unlocked-sample"
            )
            round_data.roundId = "round/with space"
            final_payload = {
                "contractVersion": AI_ANALYTICS_CONTRACT_VERSION,
                "roundId": "round/with space",
                "status": "success",
                "stones": {},
            }
            send_callback = AsyncMock()

            with (
                patch.object(
                    mcp_client_manager,
                    "fetch_round_analytics",
                    new=AsyncMock(return_value=round_data),
                ),
                patch.object(
                    analytics_graph,
                    "ainvoke",
                    new=AsyncMock(return_value={"final_payload": final_payload}),
                ),
                patch.object(
                    analytics_runner_service,
                    "_send_callback",
                    new=send_callback,
                ),
            ):
                await analytics_runner_service.process_round("round/with space")

            send_callback.assert_awaited_once_with(
                "https://data-layer.example/api/rounds/"
                "round%2Fwith%20space/ai-insights/",
                final_payload,
            )

        previous_callback_url = settings.data_layer_callback_url
        try:
            settings.data_layer_callback_url = (
                "https://data-layer.example/api/rounds"
            )
            asyncio.run(process_round())
        finally:
            settings.data_layer_callback_url = previous_callback_url

        print("✔ Test 13 Passed: Callback POST uses the canonical trailing-slash route.")

    def test_14_background_context_reaches_the_prompt_on_4_0_and_5_0(self):
        """1.0-3.0 keep their meaning; 4.0 and 5.0 carry the school context."""
        from src.agents.nodes import _background_context_for_prompt

        background_context = {"notes": "שני מורים חדשים", "newStaffMembers": 2}
        state: AnalyticsState = {
            "round_data": {},
            "org_context": {},
            "interpretations": {},
            "recommendations": {},
            "safety_status": "pending",
            "safety_feedback": None,
            "retry_count": 0,
            "final_payload": {},
        }

        for version in ("1.0", "2.0", "3.0"):
            round_data = {
                "contractVersion": version,
                "backgroundContext": background_context,
            }
            self.assertIsNone(
                _background_context_for_prompt(round_data, state),
                f"contract {version} must not receive the school context",
            )

        for version in ("4.0", "5.0"):
            round_data = {
                "contractVersion": version,
                "backgroundContext": background_context,
            }
            self.assertEqual(
                _background_context_for_prompt(round_data, state),
                background_context,
                f"contract {version} must receive the school context",
            )

        print(
            "✔ Test 14 Passed: School background context reaches the prompt on "
            "contracts 4.0 and 5.0."
        )

    @staticmethod
    def _definition_hash(questions):
        """Mirrors Core's snapshot hash over the exact AI-visible questions."""
        import hashlib
        import json

        projection = [
            {
                "questionId": question["questionId"],
                "dimensionId": question["dimensionId"],
                "questionText": question["questionText"],
            }
            for question in sorted(
                questions,
                key=lambda question: question["questionId"],
            )
        ]
        serialized = json.dumps(
            projection,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        return f"sha256:{hashlib.sha256(serialized).hexdigest()}"

    def test_15_contract_4_0_parses_like_3_0_and_keeps_background_context(self):
        """4.0 must take the dynamic path, not the legacy fallback.

        Every dynamic rule (required ids, hash, questionText aggregates) has to
        apply, and the school context has to survive parsing, or the prompt on
        4.0 silently receives nothing.
        """
        from src.contracts import AI_ANALYTICS_DIMENSION_IDS
        from src.schemas.mcp_types import RoundAnalyticsResult

        questions = [
            {
                "questionId": f"{dimension_id}-q1",
                "dimensionId": dimension_id,
                "questionText": "עד כמה ההיגד משקף את מצבך?",
                "averageScore": 60,
                "responseCount": 12,
            }
            for dimension_id in AI_ANALYTICS_DIMENSION_IDS
        ]
        background_context = {"notes": "מיזוג שתי שכבות", "newStaffMembers": 2}
        payload = {
            "contractVersion": "4.0",
            "roundId": "round-v4",
            "organizationId": "org-v4",
            "surveyDefinitionHash": self._definition_hash(questions),
            "totalResponses": 12,
            "privacyThreshold": 1,
            "isLocked": False,
            "dimensionScores": {
                dimension_id: {
                    "dimensionId": dimension_id,
                    "averageScore": 60,
                    "computedStatus": "yellow",
                    "responseCount": 12,
                }
                for dimension_id in AI_ANALYTICS_DIMENSION_IDS
            },
            "questionAggregates": {
                question["questionId"]: question for question in questions
            },
            "calculatedAt": "2026-07-27T12:00:00Z",
            "backgroundContext": background_context,
        }

        parsed = RoundAnalyticsResult.from_dict(payload).to_dict()

        self.assertEqual(parsed["contractVersion"], "4.0")
        self.assertEqual(parsed["organizationId"], "org-v4")
        self.assertEqual(
            parsed["surveyDefinitionHash"],
            payload["surveyDefinitionHash"],
        )
        self.assertEqual(parsed["backgroundContext"], background_context)
        first_aggregate = parsed["questionAggregates"][questions[0]["questionId"]]
        self.assertIn("questionText", first_aggregate)
        self.assertNotIn("questionTextHebrew", first_aggregate)

        # A respondent-level field must still be refused on 4.0.
        with self.assertRaises(ValueError):
            RoundAnalyticsResult.from_dict(
                {**payload, "respondentId": "resp-1"},
            )

        print(
            "✔ Test 15 Passed: Contract 4.0 parses on the dynamic path and "
            "keeps the school background context."
        )

    def test_16_a_round_below_the_requirement_is_raised_and_locked(self):
        """A round configured below ten is read as locked, not refused.

        Until 2026-07-27 the product default was 1 and this test asserted the
        consumer must honour it. Ten respondents is now the requirement on both
        sides, so a payload that still carries a lower threshold — an older
        round, an older Core — has its threshold raised here and its detail
        left unread, rather than being dropped with an error.
        """
        from src.contracts import AI_ANALYTICS_DIMENSION_IDS
        from src.schemas.mcp_types import RoundAnalyticsResult

        payload = {
            "contractVersion": "3.0",
            "roundId": "round-threshold-1",
            "organizationId": "org-threshold-1",
            "surveyDefinitionHash": self._definition_hash(
                [
                    {
                        "questionId": f"{dimension_id}-q1",
                        "dimensionId": dimension_id,
                        "questionText": "עד כמה ההיגד משקף את מצבך?",
                    }
                    for dimension_id in AI_ANALYTICS_DIMENSION_IDS
                ],
            ),
            "totalResponses": 3,
            "privacyThreshold": 1,
            "isLocked": False,
            "dimensionScores": {
                dimension_id: {
                    "dimensionId": dimension_id,
                    "averageScore": 60,
                    "computedStatus": "yellow",
                    "responseCount": 3,
                }
                for dimension_id in AI_ANALYTICS_DIMENSION_IDS
            },
            "questionAggregates": {
                f"{dimension_id}-q1": {
                    "questionId": f"{dimension_id}-q1",
                    "dimensionId": dimension_id,
                    "questionText": "עד כמה ההיגד משקף את מצבך?",
                    "averageScore": 60,
                    "responseCount": 3,
                }
                for dimension_id in AI_ANALYTICS_DIMENSION_IDS
            },
            "calculatedAt": "2026-07-27T12:00:00Z",
        }

        parsed = RoundAnalyticsResult.from_dict(payload)

        self.assertEqual(parsed.privacyThreshold, 10)
        self.assertTrue(parsed.isLocked)
        self.assertEqual(parsed.dimensionScores, {})
        self.assertEqual(parsed.questionAggregates, {})

        with self.assertRaises(ValueError):
            RoundAnalyticsResult.from_dict({**payload, "privacyThreshold": 0})

        # Ten answers to every question is the same payload above the line.
        wide = {
            **payload,
            "totalResponses": 12,
            "dimensionScores": {
                dimension_id: {**score, "responseCount": 12}
                for dimension_id, score in payload["dimensionScores"].items()
            },
            "questionAggregates": {
                key: {**aggregate, "responseCount": 12}
                for key, aggregate in payload["questionAggregates"].items()
            },
        }
        parsed_wide = RoundAnalyticsResult.from_dict(wide)

        self.assertFalse(parsed_wide.isLocked)
        self.assertEqual(parsed_wide.privacyThreshold, 10)

        print(
            "✔ Test 16 Passed: The dynamic contract accepts the product "
            "default privacy threshold of 1."
        )
