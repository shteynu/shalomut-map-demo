import unittest
import hashlib
import json

import pytest

from src.agents.nodes import agent_psychologist_node, agent_safety_validator_node
from src.agents.state import AnalyticsState
from src.config import settings
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_V5_CONTRACT_VERSION,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
)
from src.schemas.mcp_types import RoundAnalyticsResult
from src.services.llm_provider import llm_provider_service

BACKGROUND_CONTEXT = {"notes": "שני מורים חדשים השנה", "newStaffMembers": 2}


def build_v5_round_data(background_context=None):
    """A privacy-safe 5.0 round: one yellow question per canonical dimension."""
    aggregates = {
        f"q-{index + 1}": {
            "questionId": f"q-{index + 1}",
            "dimensionId": dimension_id,
            "questionText": "עד כמה ההיגד משקף את מצבך?",
            "averageScore": 60.0,
            "responseCount": 20,
            "scoreDistribution": {"green": 4, "yellow": 12, "red": 4},
        }
        for index, dimension_id in enumerate(AI_ANALYTICS_DIMENSION_IDS)
    }
    round_data = {
        "contractVersion": AI_ANALYTICS_V5_CONTRACT_VERSION,
        "roundId": "round-v5-node",
        "organizationId": "org-v5",
        "surveyDefinitionHash": "sha256:" + "0" * 64,
        "totalResponses": 20,
        "privacyThreshold": 1,
        "isLocked": False,
        "dimensionScores": {
            dimension_id: {
                "dimensionId": dimension_id,
                "averageScore": 60.0,
                "computedStatus": "yellow",
                "responseCount": 20,
            }
            for dimension_id in AI_ANALYTICS_DIMENSION_IDS
        },
        "questionAggregates": aggregates,
        "calculatedAt": "2026-07-27T12:00:00Z",
    }
    if background_context is not None:
        round_data["backgroundContext"] = background_context
    return round_data


def build_state(round_data) -> AnalyticsState:
    return {
        "round_data": round_data,
        "org_context": {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }


@pytest.mark.asyncio
async def test_v5_prompt_and_provenance_carry_the_school_context(monkeypatch):
    """5.0 adds distributions to 4.0; it must not drop the school context.

    Core sends `backgroundContext` on 4.0 and 5.0 alike, so gating the prompt
    on 4.0 made the upgrade a trade instead of an addition.
    """
    monkeypatch.setattr(settings, "llm_api_key", "", raising=False)
    round_data = build_v5_round_data(BACKGROUND_CONTEXT)

    state = await agent_psychologist_node(build_state(round_data))

    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        provenance = state["generation_provenance"][dimension_id]
        assert provenance["backgroundContextIncluded"] is True, dimension_id
        assert provenance["distributionIncluded"] is True, dimension_id
        assert provenance["crossDimensionContextIncluded"] is True, dimension_id

    prompt = llm_provider_service._build_prompt(
        dim_id="balance",
        dim_hebrew="איזון",
        score=60.0,
        status="yellow",
        question_aggregates=[
            aggregate
            for aggregate in round_data["questionAggregates"].values()
            if aggregate["dimensionId"] == "balance"
        ],
        background_context=BACKGROUND_CONTEXT,
        contract_version=AI_ANALYTICS_V5_CONTRACT_VERSION,
        all_dimension_scores=round_data["dimensionScores"],
    )
    assert "School Background Context" in prompt
    assert BACKGROUND_CONTEXT["notes"] in prompt


@pytest.mark.asyncio
async def test_v5_provenance_reports_a_missing_school_context(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "", raising=False)

    state = await agent_psychologist_node(build_state(build_v5_round_data()))

    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        provenance = state["generation_provenance"][dimension_id]
        assert provenance["backgroundContextIncluded"] is False, dimension_id


class TestContractV5(unittest.TestCase):
    def test_version_constants(self):
        self.assertEqual(AI_ANALYTICS_V5_CONTRACT_VERSION, "5.0")
        self.assertIn("5.0", AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS)
        self.assertIn("5.0", AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS)

    def test_parse_v5_payload_with_valid_distribution(self):
        dimensions = [
            "self-expression",
            "professional-competence",
            "social-resource",
            "balance",
            "management-support",
            "certainty",
            "organizational-climate",
            "meaning",
        ]
        question_aggregates = {}
        projection = []
        for i, dim in enumerate(dimensions):
            qid = f"q-{i+1}"
            q_item = {
                "questionId": qid,
                "dimensionId": dim,
                "questionText": "שאלה בעברית לתשובה",
                "averageScore": 70.0,
                "responseCount": 20,
                "scoreDistribution": {"green": 10, "yellow": 8, "red": 2},
            }
            question_aggregates[qid] = q_item
            projection.append({
                "questionId": qid,
                "dimensionId": dim,
                "questionText": "שאלה בעברית לתשובה",
            })

        serialized = json.dumps(projection, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        hash_val = f"sha256:{hashlib.sha256(serialized).hexdigest()}"

        payload = {
            "contractVersion": "5.0",
            "roundId": "round-v5-python",
            "organizationId": "org-v5",
            "calculatedAt": "2026-07-27T12:00:00Z",
            "surveyDefinitionHash": hash_val,
            "totalResponses": 20,
            "privacyThreshold": 1,
            "isLocked": False,
            "dimensionScores": {
                dim: {
                    "dimensionId": dim,
                    "averageScore": 70.0,
                    "computedStatus": "yellow",
                    "responseCount": 20,
                }
                for dim in dimensions
            },
            "questionAggregates": question_aggregates,
        }

        res = RoundAnalyticsResult.from_dict(payload)
        self.assertEqual(res.contractVersion, "5.0")
        self.assertEqual(res.questionAggregates["q-1"]["scoreDistribution"], {"green": 10, "yellow": 8, "red": 2})

    def test_reject_v5_payload_with_invalid_sum(self):
        dimensions = [
            "self-expression",
            "professional-competence",
            "social-resource",
            "balance",
            "management-support",
            "certainty",
            "organizational-climate",
            "meaning",
        ]
        question_aggregates = {}
        for i, dim in enumerate(dimensions):
            qid = f"q-{i+1}"
            question_aggregates[qid] = {
                "questionId": qid,
                "dimensionId": dim,
                "questionText": "שאלה בעברית לתשובה",
                "averageScore": 70.0,
                "responseCount": 20,
                "scoreDistribution": {"green": 10, "yellow": 8, "red": 5}, # sum = 23 != 20
            }

        payload = {
            "contractVersion": "5.0",
            "roundId": "round-v5-python",
            "organizationId": "org-v5",
            "calculatedAt": "2026-07-27T12:00:00Z",
            "surveyDefinitionHash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
            "totalResponses": 20,
            "privacyThreshold": 1,
            "isLocked": False,
            "dimensionScores": {},
            "questionAggregates": question_aggregates,
        }

        with self.assertRaises(ValueError):
            RoundAnalyticsResult.from_dict(payload)


if __name__ == "__main__":
    unittest.main()


@pytest.mark.asyncio
async def test_v5_provenance_reports_a_missing_distribution(monkeypatch):
    """The pair of flags has to be able to say "no", or it audits nothing."""
    monkeypatch.setattr(settings, "llm_api_key", "", raising=False)
    round_data = build_v5_round_data(BACKGROUND_CONTEXT)
    for aggregate in round_data["questionAggregates"].values():
        aggregate.pop("scoreDistribution")

    state = await agent_psychologist_node(build_state(round_data))

    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        provenance = state["generation_provenance"][dimension_id]
        assert provenance["distributionIncluded"] is False, dimension_id
        assert provenance["crossDimensionContextIncluded"] is True, dimension_id

    # A truthful "no" is a valid result, not a safety failure.
    validated = agent_safety_validator_node(state)
    assert validated["safety_status"] == "pass", validated.get("safety_feedback")


@pytest.mark.asyncio
async def test_v5_safety_validator_rejects_an_overstated_provenance(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "", raising=False)
    round_data = build_v5_round_data(BACKGROUND_CONTEXT)
    for aggregate in round_data["questionAggregates"].values():
        aggregate.pop("scoreDistribution")

    state = await agent_psychologist_node(build_state(round_data))
    for provenance in state["generation_provenance"].values():
        provenance["distributionIncluded"] = True

    validated = agent_safety_validator_node(state)

    assert validated["safety_status"] == "fail"
    assert "Generation provenance is invalid" in validated["safety_feedback"]


def _summary_response(content):
    class _Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return json.dumps(
                {
                    "choices": [
                        {
                            "finish_reason": "stop",
                            "message": {"content": content},
                        },
                    ],
                },
            ).encode("utf-8")

    return _Response()


def test_overall_summary_prompt_carries_distributions_and_context():
    round_data = build_v5_round_data(BACKGROUND_CONTEXT)

    prompt = llm_provider_service._build_overall_summary_prompt(
        round_data["dimensionScores"],
        list(round_data["questionAggregates"].values()),
        BACKGROUND_CONTEXT,
    )

    # Score and status alone cannot tell "all yellow" from "half green, half
    # red", so the round summary has to see the buckets too.
    assert "פיזור: 4 ירוק / 12 צהוב / 4 אדום" in prompt
    assert BACKGROUND_CONTEXT["notes"] in prompt


def test_overall_summary_uses_the_shared_transport(monkeypatch):
    accepted = (
        "התמונה הכללית מצביעה על צוות יציב עם עומס נקודתי. "
        "מומלץ למקד את תשומת הלב באיזון ובוודאות. "
        "שאר הממדים משמרים חוזקה."
    )
    captured = {}

    def fake_urlopen(request, timeout=None):
        captured.update(json.loads(request.data.decode("utf-8")))
        return _summary_response(accepted)

    monkeypatch.setattr(settings, "llm_api_key", "sk-test-summary")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "max_tokens_per_dimension", 420)
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    round_data = build_v5_round_data(BACKGROUND_CONTEXT)
    summary = llm_provider_service.generate_overall_summary(
        dim_scores=round_data["dimensionScores"],
        background_context=BACKGROUND_CONTEXT,
        contract_version=AI_ANALYTICS_V5_CONTRACT_VERSION,
        question_aggregates=list(round_data["questionAggregates"].values()),
    )

    assert summary == accepted
    # The hardcoded 300-token cap of the first implementation is gone.
    assert captured["max_tokens"] == 420


def test_overall_summary_falls_back_when_the_provider_fails(monkeypatch):
    def fake_urlopen(request, timeout=None):
        raise OSError("provider offline")

    monkeypatch.setattr(settings, "llm_api_key", "sk-test-summary")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    round_data = build_v5_round_data()
    summary = llm_provider_service.generate_overall_summary(
        dim_scores=round_data["dimensionScores"],
        contract_version=AI_ANALYTICS_V5_CONTRACT_VERSION,
        question_aggregates=list(round_data["questionAggregates"].values()),
    )

    assert "הניתוח המצרפי מציג 8 ממדים" in summary


def test_overall_summary_rejects_a_five_sentence_answer(monkeypatch):
    too_long = (
        "משפט ראשון. משפט שני. משפט שלישי. משפט רביעי. משפט חמישי."
    )
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-summary")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda request, timeout=None: _summary_response(too_long),
    )

    round_data = build_v5_round_data()
    summary = llm_provider_service.generate_overall_summary(
        dim_scores=round_data["dimensionScores"],
        contract_version=AI_ANALYTICS_V5_CONTRACT_VERSION,
        question_aggregates=list(round_data["questionAggregates"].values()),
    )

    assert summary != too_long
    assert "הניתוח המצרפי מציג" in summary


def test_overall_summary_stays_deterministic_before_5_0(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-summary")
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda request, timeout=None: _summary_response("לא אמור להיקרא. בכלל."),
    )

    round_data = build_v5_round_data()
    for version in ("2.0", "3.0", "4.0"):
        summary = llm_provider_service.generate_overall_summary(
            dim_scores=round_data["dimensionScores"],
            contract_version=version,
        )
        assert "הניתוח המצרפי מציג" in summary
