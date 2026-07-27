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
