import unittest
import hashlib
import json
import re
from contextlib import contextmanager
from unittest.mock import patch

import pytest

from src.agents.graph import analytics_graph
from src.agents.nodes import (
    agent_adaptation_node,
    agent_psychologist_node,
    agent_rag_intervention_node,
    agent_safety_validator_node,
)
from src.agents.state import AnalyticsState
from src.config import settings
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
    AI_ANALYTICS_V4_CONTRACT_VERSION,
    AI_ANALYTICS_V5_CONTRACT_VERSION,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
)
from src.schemas.mcp_types import RoundAnalyticsResult
from src.services.llm_provider import (
    ProviderUnavailableError,
    llm_provider_service,
)

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
async def test_v5_prompt_and_provenance_carry_the_school_context(answering_llm):
    """5.0 adds distributions to 4.0; it must not drop the school context.

    Core sends `backgroundContext` on 4.0 and 5.0 alike, so gating the prompt
    on 4.0 made the upgrade a trade instead of an addition.
    """
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
    assert "רקע בית הספר" in prompt
    assert BACKGROUND_CONTEXT["notes"] in prompt


@pytest.mark.asyncio
async def test_v5_provenance_reports_a_missing_school_context(answering_llm):
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
async def test_v5_provenance_reports_a_missing_distribution(answering_llm):
    """The pair of flags has to be able to say "no", or it audits nothing."""
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
async def test_v5_safety_validator_rejects_an_overstated_provenance(answering_llm):
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


def test_overall_summary_fails_the_round_when_the_provider_fails(monkeypatch):
    """On 5.0 the round summary is the model's sentence or it is nothing.

    The counted sentence below 5.0 is written here by design; reusing it as a
    stand-in for an offline provider would present a failed round as a finished
    one.
    """
    def fake_urlopen(request, timeout=None):
        raise OSError("provider offline")

    monkeypatch.setattr(settings, "llm_api_key", "sk-test-summary")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    round_data = build_v5_round_data()
    with pytest.raises(ProviderUnavailableError) as failure:
        llm_provider_service.generate_overall_summary(
            dim_scores=round_data["dimensionScores"],
            contract_version=AI_ANALYTICS_V5_CONTRACT_VERSION,
            question_aggregates=list(
                round_data["questionAggregates"].values(),
            ),
        )

    assert failure.value.reason == "OSError"


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
    with pytest.raises(ProviderUnavailableError):
        llm_provider_service.generate_overall_summary(
            dim_scores=round_data["dimensionScores"],
            contract_version=AI_ANALYTICS_V5_CONTRACT_VERSION,
            question_aggregates=list(
                round_data["questionAggregates"].values(),
            ),
        )


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


ADAPTED_SUMMARY = "לפי 12 התשובות באמצע הסולם העומס מתרכז בסוף השבוע."
ADAPTED_STEP = "לקיים מפגש צוות קצר לתעדוף המשימות."


def _prompt_of(request) -> str:
    payload = json.loads(request.data.decode("utf-8"))
    return payload["messages"][-1]["content"]


_BATCH_STEP_COUNTS = re.compile(r"שלבי ההמלצה בקטלוג \((\d+) שלבים\)")


def _adaptation_response(request, timeout=None):
    """Answer whatever the prompt asked for: one block per catalog entry.

    A dimension is adapted in one request now, so the answer carries a block
    per entry separated by "===". The entries do not all carry the same number
    of steps, and the rewrite has to keep each entry's own count — which is why
    the stub reads the counts back out of the prompt instead of assuming them.
    """
    prompt = _prompt_of(request)
    step_counts = [int(count) for count in _BATCH_STEP_COUNTS.findall(prompt)]
    blocks = [
        "\n".join([ADAPTED_SUMMARY] + [f"- {ADAPTED_STEP}"] * count)
        for count in step_counts
    ]
    return _summary_response("\n===\n".join(blocks))


async def _adapted_state(round_data, monkeypatch, urlopen):
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-adaptation")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)
    monkeypatch.setattr("urllib.request.urlopen", urlopen)

    state = agent_rag_intervention_node(build_state(round_data))
    catalog = {
        dimension_id: [dict(item) for item in interventions]
        for dimension_id, interventions in state["recommendations"].items()
    }
    return catalog, await agent_adaptation_node(state)


@pytest.mark.asyncio
async def test_adaptation_rewrites_the_catalog_copy_for_this_school(monkeypatch):
    """The gain the original plan called the main one.

    A school reads the catalog paragraph written for every school unless
    something rewrites it against the numbers this round actually produced.
    """
    catalog, state = await _adapted_state(
        build_v5_round_data(BACKGROUND_CONTEXT),
        monkeypatch,
        _adaptation_response,
    )

    for dimension_id, interventions in state["recommendations"].items():
        for index, intervention in enumerate(interventions):
            original = catalog[dimension_id][index]
            assert intervention["adaptationOutcome"] == "llm"
            assert intervention["summary"] == ADAPTED_SUMMARY
            assert intervention["summary"] != original["summary"]
            assert any(character.isdigit() for character in intervention["summary"])
            assert len(intervention["actionable_steps"]) == len(
                original["actionable_steps"],
            )
            # Core owns these, and a rewrite may not touch them.
            for field in ("id", "dimensionId", "status", "source", "title"):
                assert intervention[field] == original[field]


@pytest.mark.asyncio
async def test_a_dimension_costs_one_adaptation_request(monkeypatch):
    """The reason the batch exists, stated as an invariant.

    The free provider tier allows twenty requests a day. A round used to spend
    one per catalog entry — eight dimensions of three — so the adaptation node
    alone outran a day's quota before the interpretations were counted. It now
    spends one request per dimension, and this fails the moment that regresses.
    """
    prompts = []

    def counting(request, timeout=None):
        prompts.append(_prompt_of(request))
        return _adaptation_response(request, timeout)

    catalog, state = await _adapted_state(
        build_v5_round_data(),
        monkeypatch,
        counting,
    )

    entries = sum(len(interventions) for interventions in catalog.values())
    assert entries > len(catalog), (
        "the fixture must hold dimensions of several entries, or this proves "
        "nothing"
    )
    assert len(prompts) == len(catalog)
    # The saving must not have cost the rewrite itself.
    for interventions in state["recommendations"].values():
        for intervention in interventions:
            assert intervention["adaptationOutcome"] == "llm"


@pytest.mark.asyncio
async def test_one_bad_block_falls_the_whole_dimension_back(monkeypatch):
    """All or nothing per dimension, deliberately.

    Keeping the good blocks of a partly refused answer would leave a dimension
    where some recommendations speak to this round and others quietly do not,
    with nothing on the page telling them apart. The catalog text is human
    written, so falling back together stays honest.
    """
    def one_block_short(request, timeout=None):
        prompt = _prompt_of(request)
        counts = [int(count) for count in _BATCH_STEP_COUNTS.findall(prompt)]
        blocks = [
            "\n".join([ADAPTED_SUMMARY] + [f"- {ADAPTED_STEP}"] * count)
            for count in counts[:-1]
        ]
        return _summary_response("\n===\n".join(blocks))

    catalog, state = await _adapted_state(
        build_v5_round_data(),
        monkeypatch,
        one_block_short,
    )

    for dimension_id, interventions in state["recommendations"].items():
        for index, intervention in enumerate(interventions):
            original = catalog[dimension_id][index]
            assert intervention["adaptationOutcome"] == "deterministic_fallback"
            assert intervention["summary"] == original["summary"]
            assert intervention["actionable_steps"] == original[
                "actionable_steps"
            ]


@pytest.mark.asyncio
async def test_adaptation_falls_back_to_the_catalog_text_verbatim(monkeypatch):
    def offline(request, timeout=None):
        raise OSError("provider offline")

    catalog, state = await _adapted_state(
        build_v5_round_data(),
        monkeypatch,
        offline,
    )

    for dimension_id, interventions in state["recommendations"].items():
        for index, intervention in enumerate(interventions):
            original = catalog[dimension_id][index]
            assert intervention["adaptationOutcome"] == "deterministic_fallback"
            assert intervention["summary"] == original["summary"]
            assert intervention["actionable_steps"] == original["actionable_steps"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "summary_line,steps",
    [
        # Latin letters in user-facing copy.
        ("The workload peaks on Friday, 12 answers.", 2),
        # No number from the round: the catalog text in other words.
        ("העומס מתרכז בסוף השבוע.", 2),
        # A verdict in another colour on a yellow dimension.
        ("לפי 12 התשובות הממד נמצא באזור אדום.", 2),
        # More steps than the catalog entry holds.
        (ADAPTED_SUMMARY, 3),
        # Not shaped like a summary followed by steps.
        (ADAPTED_SUMMARY, 0),
    ],
)
async def test_adaptation_refuses_an_answer_it_cannot_stand_behind(
    monkeypatch,
    summary_line,
    steps,
):
    """Every catalog entry carries exactly two steps.

    So each case here differs from an acceptable answer in one way only, and
    the rejection cannot be credited to a broken shape it did not intend.
    """
    answer = "\n".join([summary_line] + [f"- {ADAPTED_STEP}"] * steps)

    def bad_answer(request, timeout=None):
        return _summary_response(answer)

    catalog, state = await _adapted_state(
        build_v5_round_data(),
        monkeypatch,
        bad_answer,
    )

    for dimension_id, interventions in state["recommendations"].items():
        for index, intervention in enumerate(interventions):
            assert intervention["adaptationOutcome"] == "deterministic_fallback"
            assert (
                intervention["summary"] == catalog[dimension_id][index]["summary"]
            )


@pytest.mark.asyncio
async def test_adaptation_leaves_contracts_before_5_0_untouched(monkeypatch):
    """1.0-4.0 are deployed boundaries; their stored results keep their meaning."""
    round_data = build_v5_round_data()
    round_data["contractVersion"] = "4.0"

    catalog, state = await _adapted_state(
        round_data,
        monkeypatch,
        _adaptation_response,
    )

    for dimension_id, interventions in state["recommendations"].items():
        for index, intervention in enumerate(interventions):
            assert "adaptationOutcome" not in intervention
            assert intervention["summary"] == catalog[dimension_id][index]["summary"]


@pytest.mark.asyncio
async def test_v5_safety_validator_rejects_a_rewrite_that_contradicts_the_status(
    answering_llm,
):
    round_data = build_v5_round_data()
    state = await agent_psychologist_node(build_state(round_data))
    state = agent_rag_intervention_node(state)
    state = await agent_adaptation_node(state)

    assert agent_safety_validator_node(state)["safety_status"] == "pass"

    intervention = state["recommendations"]["balance"][0]
    intervention["adaptationOutcome"] = "llm"
    intervention["summary"] = "הממד נמצא באזור אדום ודורש טיפול מיידי."

    validated = agent_safety_validator_node(state)
    assert validated["safety_status"] == "fail"
    assert "Intervention is invalid" in validated["safety_feedback"]


@pytest.mark.asyncio
async def test_the_whole_5_0_round_declares_how_every_recommendation_was_written(
    monkeypatch,
    answering_llm,
):
    """What Core will validate: the field is on the payload, not just in state."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-adaptation")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)
    monkeypatch.setattr("urllib.request.urlopen", _adaptation_response)

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data(BACKGROUND_CONTEXT)),
    )
    payload = final_state["final_payload"]

    assert payload["status"] == "success", payload.get("errorMessage")
    for dimension_id, stone in payload["stones"].items():
        assert stone["recommendedInterventions"], dimension_id
        for intervention in stone["recommendedInterventions"]:
            assert intervention["adaptationOutcome"] == "llm", dimension_id
            assert intervention["summary"] == ADAPTED_SUMMARY


def build_v5_input_payload(**overrides):
    """The Core -> Python payload, not the round data the graph works on."""
    round_data = build_v5_round_data()
    payload = {
        key: value
        for key, value in round_data.items()
        if key != "backgroundContext"
    }
    payload.update(overrides)
    payload["surveyDefinitionHash"] = _definition_hash(
        payload["questionAggregates"],
    )
    return payload


def _definition_hash(question_aggregates):
    projection = [
        {
            "questionId": aggregate["questionId"],
            "dimensionId": aggregate["dimensionId"],
            "questionText": aggregate["questionText"],
        }
        for aggregate in sorted(
            question_aggregates.values(),
            key=lambda aggregate: aggregate["questionId"],
        )
    ]
    serialized = json.dumps(
        projection,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(serialized).hexdigest()}"


def test_a_locked_5_0_payload_may_not_carry_distributions():
    """`forbiddenWhenLocked` has to be a refusal, not a silent drop.

    A locked round is one where a single answer could identify a respondent.
    Quietly discarding the aggregates would let a producer bug ship
    below-threshold distributions across the service boundary unnoticed; the
    payload is refused instead, and the mistake surfaces where it was made.
    """
    payload = build_v5_input_payload(
        isLocked=True,
        dimensionScores={},
    )

    with pytest.raises(ValueError, match="requires empty"):
        RoundAnalyticsResult.from_dict(payload)


def test_a_below_threshold_5_0_payload_may_not_carry_distributions():
    """The lock is derived, so claiming `isLocked: false` does not lift it.

    Everything else in the payload is made consistent with three answers, so
    the refusal can only come from the emptiness rule.
    """
    payload = build_v5_input_payload(
        totalResponses=3,
        privacyThreshold=10,
        isLocked=False,
    )
    for score in payload["dimensionScores"].values():
        score["responseCount"] = 3
    for aggregate in payload["questionAggregates"].values():
        aggregate["responseCount"] = 3
        aggregate["scoreDistribution"] = {"green": 1, "yellow": 1, "red": 1}

    with pytest.raises(ValueError, match="requires empty"):
        RoundAnalyticsResult.from_dict(payload)


def test_a_locked_5_0_payload_without_details_is_accepted():
    payload = build_v5_input_payload(
        isLocked=True,
        dimensionScores={},
        questionAggregates={},
    )

    parsed = RoundAnalyticsResult.from_dict(payload)

    assert parsed.isLocked is True
    assert parsed.questionAggregates == {}
    assert parsed.dimensionScores == {}


def test_an_unlocked_5_0_payload_requires_every_distribution():
    payload = build_v5_input_payload()
    payload["questionAggregates"]["q-1"].pop("scoreDistribution")

    with pytest.raises(ValueError, match="requires scoreDistribution"):
        RoundAnalyticsResult.from_dict(payload)


def test_a_5_0_payload_keeps_the_school_context_through_the_parser():
    """The boundary the node-level tests step over.

    Every other 5.0 context test builds `round_data` by hand and starts at the
    node, so the parser was free to drop the field and stay green. Core sends
    the context on 4.0 and 5.0 alike (`src/app/api/mcp/route.ts`), and 5.0 is
    4.0 plus distributions, so an upgrade that trades the context away is a
    loss of a promised field, not a redesign.
    """
    payload = build_v5_input_payload(backgroundContext=BACKGROUND_CONTEXT)

    parsed = RoundAnalyticsResult.from_dict(payload)

    assert parsed.backgroundContext == BACKGROUND_CONTEXT


def test_a_4_0_payload_keeps_the_school_context_through_the_parser():
    """The version that already worked, so the fix cannot be a swap."""
    payload = build_v5_input_payload(backgroundContext=BACKGROUND_CONTEXT)
    payload["contractVersion"] = AI_ANALYTICS_V4_CONTRACT_VERSION
    for aggregate in payload["questionAggregates"].values():
        aggregate.pop("scoreDistribution", None)

    parsed = RoundAnalyticsResult.from_dict(payload)

    assert parsed.backgroundContext == BACKGROUND_CONTEXT


def test_a_3_0_payload_carries_no_school_context_past_the_parser():
    """3.0 is immutable: it has no `backgroundContext`, and gains none here."""
    payload = build_v5_input_payload(backgroundContext=BACKGROUND_CONTEXT)
    payload["contractVersion"] = AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION
    for aggregate in payload["questionAggregates"].values():
        aggregate.pop("scoreDistribution", None)

    parsed = RoundAnalyticsResult.from_dict(payload)

    assert parsed.backgroundContext == {}


@pytest.mark.asyncio
async def test_parsed_5_0_round_data_still_reaches_the_prompt(answering_llm):
    """Parser and node joined up, which is the pair that actually shipped.

    `from_dict(...).to_dict()` is the exact shape `analytics_runner` hands the
    graph, so running the node on it is what proves the context survives the
    whole way rather than at either end alone.
    """
    payload = build_v5_input_payload(backgroundContext=BACKGROUND_CONTEXT)
    round_data = RoundAnalyticsResult.from_dict(payload).to_dict()

    state = await agent_psychologist_node(build_state(round_data))

    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        provenance = state["generation_provenance"][dimension_id]
        assert provenance["backgroundContextIncluded"] is True, dimension_id

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
        background_context=round_data["backgroundContext"],
        contract_version=AI_ANALYTICS_V5_CONTRACT_VERSION,
        all_dimension_scores=round_data["dimensionScores"],
    )
    assert "רקע בית הספר" in prompt
    assert BACKGROUND_CONTEXT["notes"] in prompt


@pytest.mark.asyncio
async def test_a_locked_5_0_round_keeps_the_context_away_from_the_provider(
    monkeypatch,
):
    """Preserving the context must not widen what a locked round may do.

    Core does not send the context for a locked round at all, so this covers
    the producer bug rather than the normal path: even carrying it, a locked
    round stops at the privacy gate and no prompt is ever built.
    """
    payload = build_v5_input_payload(
        isLocked=True,
        dimensionScores={},
        questionAggregates={},
        backgroundContext=BACKGROUND_CONTEXT,
    )
    parsed = RoundAnalyticsResult.from_dict(payload)

    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("provider must not run for a locked round")

    monkeypatch.setattr(
        llm_provider_service,
        "generate_psychological_interpretation_result",
        fail_if_called,
    )

    final_payload = (
        await analytics_graph.ainvoke(build_state(parsed.to_dict()))
    )["final_payload"]

    assert final_payload["status"] == "locked_error"
    assert BACKGROUND_CONTEXT["notes"] not in json.dumps(
        final_payload,
        ensure_ascii=False,
    )


@pytest.mark.asyncio
async def test_5_0_metrics_echo_the_input_distribution_untouched(answering_llm):
    """Core owns the number; the service returns it, it does not recompute it."""
    round_data = build_v5_round_data()

    payload = (await analytics_graph.ainvoke(build_state(round_data)))[
        "final_payload"
    ]

    for stone in payload["stones"].values():
        for metric in stone["metrics"]:
            assert metric["scoreDistribution"] == (
                round_data["questionAggregates"][metric["questionId"]][
                    "scoreDistribution"
                ]
            )
            assert (
                sum(metric["scoreDistribution"].values())
                == metric["responseCount"]
            )


@pytest.mark.asyncio
async def test_metrics_before_5_0_carry_no_distribution(answering_llm):
    round_data = build_v5_round_data()
    round_data["contractVersion"] = "4.0"

    payload = (await analytics_graph.ainvoke(build_state(round_data)))[
        "final_payload"
    ]

    for stone in payload["stones"].values():
        for metric in stone["metrics"]:
            assert "scoreDistribution" not in metric


@pytest.mark.asyncio
async def test_v5_safety_validator_rejects_an_undeclared_adaptation(answering_llm):
    state = await agent_psychologist_node(build_state(build_v5_round_data()))
    state = agent_rag_intervention_node(state)
    state = await agent_adaptation_node(state)
    state["recommendations"]["balance"][0].pop("adaptationOutcome")

    validated = agent_safety_validator_node(state)

    assert validated["safety_status"] == "fail"
    assert "Intervention is invalid" in validated["safety_feedback"]


# --- the partial map ---------------------------------------------------------
#
# One dead dimension out of eight used to discard the seven that answered and
# leave the manager with nothing. On 5.0 the gap is stated instead: the stone
# carries no interpretation and its provenance says why. It is never filled
# with heuristic copy, which would be the fallback posing as analysis.


@contextmanager
def failing_for(dimension_ids):
    """A provider that answers every dimension except the named ones.

    A context manager rather than a `monkeypatch.setattr`, because this patches
    over the `answering_llm` stub: monkeypatch tears down after a fixture set up
    before it, and would then restore the stub permanently for the rest of the
    session. Entering here keeps the two in the order they were applied.
    """
    real = llm_provider_service.generate_psychological_interpretation_result

    def answer(*, dim_id, **kwargs):
        if dim_id in dimension_ids:
            raise ProviderUnavailableError(
                "invalid_semantic_output",
                dimension_id=dim_id,
                attempts=2,
            )
        return real(dim_id=dim_id, **kwargs)

    with patch.object(
        llm_provider_service,
        "generate_psychological_interpretation_result",
        answer,
    ):
        yield


@pytest.mark.asyncio
async def test_one_dead_dimension_leaves_the_other_seven_standing(answering_llm):
    with failing_for({"certainty"}):
        state = await agent_psychologist_node(
            build_state(build_v5_round_data()),
        )

    assert state.get("safety_status") != "provider_unavailable"
    interpretations = state["interpretations"]["dimension_interpretations"]
    assert interpretations["certainty"] == ""
    assert state["generation_provenance"]["certainty"] == {
        **state["generation_provenance"]["certainty"],
        "outcome": "unavailable",
        "attempts": 2,
        "retryCount": 1,
    }
    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        if dimension_id == "certainty":
            continue
        assert interpretations[dimension_id], dimension_id
        assert (
            state["generation_provenance"][dimension_id]["outcome"] == "llm"
        ), dimension_id


@pytest.mark.asyncio
async def test_a_round_with_nothing_written_is_still_a_failure(answering_llm):
    """There is no partial map in zero stones, only a service that is down."""
    with failing_for(set(AI_ANALYTICS_DIMENSION_IDS)):
        state = await agent_psychologist_node(
            build_state(build_v5_round_data()),
        )

    assert state["safety_status"] == "provider_unavailable"


@pytest.mark.asyncio
async def test_contracts_before_5_0_still_fail_whole(answering_llm):
    """A closed contract describes eight interpretations and no gap.

    A consumer written against 4.0 has no shape to render a missing stone in,
    so the round fails there exactly as it did before.
    """
    round_data = build_v5_round_data()
    round_data["contractVersion"] = "4.0"

    with failing_for({"certainty"}):
        state = await agent_psychologist_node(build_state(round_data))

    assert state["safety_status"] == "provider_unavailable"


@pytest.mark.asyncio
async def test_the_payload_declares_the_gap_once(monkeypatch, answering_llm):
    """What Core validates: the list, and its agreement with the stones."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-partial")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)
    monkeypatch.setattr("urllib.request.urlopen", _adaptation_response)

    with failing_for({"certainty", "meaning"}):
        payload = (
            await analytics_graph.ainvoke(build_state(build_v5_round_data()))
        )["final_payload"]

    assert payload["status"] == "success", payload.get("errorMessage")
    assert payload["dimensionsWithoutInterpretation"] == ["certainty", "meaning"]
    for dimension_id in ("certainty", "meaning"):
        stone = payload["stones"][dimension_id]
        assert stone["psychologicalInterpretation"] == ""
        assert stone["generationProvenance"]["outcome"] == "unavailable"
        # The score, the metrics and the recommendations of a stone with no
        # interpretation are all real: only the paragraph is missing.
        assert stone["metrics"]
        assert stone["recommendedInterventions"]
    assert payload["stones"]["balance"]["psychologicalInterpretation"]


@pytest.mark.asyncio
async def test_a_whole_round_declares_no_gap_at_all(monkeypatch, answering_llm):
    """A full payload is byte-identical to what it was before partial maps."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-partial")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.local/v1")
    monkeypatch.setattr(settings, "llm_max_attempts", 1)
    monkeypatch.setattr("urllib.request.urlopen", _adaptation_response)

    payload = (
        await analytics_graph.ainvoke(build_state(build_v5_round_data()))
    )["final_payload"]

    assert payload["status"] == "success", payload.get("errorMessage")
    assert "dimensionsWithoutInterpretation" not in payload


@pytest.mark.asyncio
async def test_an_unavailable_stone_may_not_gain_copy_later(answering_llm):
    """The empty interpretation is a rule, not an accident of the code path.

    Anything that writes copy into a stone whose provenance says nothing was
    generated has produced exactly the thing the fallback is not allowed to be.
    """
    with failing_for({"certainty"}):
        state = await agent_psychologist_node(
            build_state(build_v5_round_data()),
        )
    state = agent_rag_intervention_node(state)
    state = await agent_adaptation_node(state)
    state["interpretations"]["dimension_interpretations"]["certainty"] = (
        "תחושת הודאות נמוכה. מומלץ לפרסם שינויים מראש."
    )

    validated = agent_safety_validator_node(state)

    assert validated["safety_status"] == "fail"
    assert "must be empty" in validated["safety_feedback"]
