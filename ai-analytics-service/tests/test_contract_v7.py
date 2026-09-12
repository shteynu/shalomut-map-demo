"""Contract `7.0`: the instrument-scale exchange.

`6.0` cannot carry the 126-item research instrument, and the reason is stated
in `docs/ai-contract-version-matrix.md`: a narrative per metric would be 108
narratives per round, and a three-colour distribution does not describe a 1–7
item. `7.0` keeps the three summary paragraphs and the five recommendations,
drops the metric narrative, and makes every aggregate say which scale it was
answered on and which way it points. These tests hold the service to exactly
that, on both sides of the boundary it speaks.
"""

import pytest

from src.agents.graph import analytics_graph
from src.contracts import (
    AI_ANALYTICS_DIMENSION_IDS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_V7_CONTRACT_VERSION,
)
from src.schemas.mcp_types import RoundAnalyticsResult
from src.schemas.stone_map_validation import outgoing_refusal, stone_map_refusal
from src.services import hebrew_prompts
from src.services.llm_provider import llm_provider_service

from tests.test_contract_v6 import build_v6_input_payload, narrative


def build_v7_input_payload(**overrides):
    """The `6.0` fixture, on `7.0`, with every statement naming its scale.

    Mixed on purpose: the instrument answers most blocks on 1–5 and the
    burnout block on 1–7, and reverse-scores its demands, so one dimension of
    the fixture carries each shape.
    """
    payload = build_v6_input_payload(
        contractVersion=AI_ANALYTICS_V7_CONTRACT_VERSION,
        roundId="round-v7-python",
    )
    for index, aggregate in enumerate(payload["questionAggregates"].values()):
        aggregate["scaleId"] = (
            "likert-7-frequency" if index % 3 == 0 else "likert-5-extent"
        )
        aggregate["polarity"] = "negative" if index % 2 == 0 else "positive"
    payload.update(overrides)
    return payload


def _state(round_data):
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


def test_v7_is_a_real_supported_dynamic_contract():
    assert AI_ANALYTICS_V7_CONTRACT_VERSION == "7.0"
    assert AI_ANALYTICS_V7_CONTRACT_VERSION in AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS
    assert AI_ANALYTICS_V7_CONTRACT_VERSION in AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS


def test_v7_parser_preserves_the_scale_and_the_polarity():
    parsed = RoundAnalyticsResult.from_dict(build_v7_input_payload())
    aggregates = parsed.questionAggregates

    assert {a["scaleId"] for a in aggregates.values()} == {
        "likert-5-extent",
        "likert-7-frequency",
    }
    assert {a["polarity"] for a in aggregates.values()} == {"positive", "negative"}
    # 5.0's distribution still travels; 7.0 only redefines what it counts.
    assert all("scoreDistribution" in a for a in aggregates.values())


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("scaleId", None),
        ("scaleId", ""),
        ("polarity", None),
        ("polarity", "reversed"),
    ],
)
def test_v7_parser_refuses_an_aggregate_without_its_scale(field, value):
    payload = build_v7_input_payload()
    aggregate = next(iter(payload["questionAggregates"].values()))
    if value is None:
        aggregate.pop(field)
    else:
        aggregate[field] = value

    with pytest.raises(ValueError, match=field):
        RoundAnalyticsResult.from_dict(payload)


def test_a_six_payload_may_still_omit_the_scale():
    # The rule is 7.0's. 6.0 rounds analysed before it existed carry none and
    # must go on parsing exactly as they did.
    parsed = RoundAnalyticsResult.from_dict(build_v6_input_payload())
    assert all("scaleId" not in a for a in parsed.questionAggregates.values())


def test_the_prompts_state_the_polarity_rule_only_when_a_scale_is_carried():
    with_scale = list(build_v7_input_payload()["questionAggregates"].values())
    without = list(build_v6_input_payload()["questionAggregates"].values())

    prompt = hebrew_prompts.v6_structured_summary_prompt(
        dim_hebrew="איזון",
        status="red",
        question_aggregates=with_scale[:1],
    )
    assert hebrew_prompts.ANSWER_SCALE_RULE in prompt
    assert "polarity" in prompt

    prompt = hebrew_prompts.v6_structured_summary_prompt(
        dim_hebrew="איזון",
        status="red",
        question_aggregates=without[:1],
    )
    assert hebrew_prompts.ANSWER_SCALE_RULE not in prompt


@pytest.mark.asyncio
async def test_v7_graph_fallback_produces_the_complete_contract(monkeypatch):
    calls = []

    def refused(**kwargs):
        calls.append(kwargs.get("scope"))
        return (None, 1, "http_503")

    monkeypatch.setattr(llm_provider_service, "_complete_with_retries", refused)
    round_data = RoundAnalyticsResult.from_dict(build_v7_input_payload()).to_dict()

    result = await analytics_graph.ainvoke(_state(round_data))
    payload = result["final_payload"]

    assert payload["status"] == "success", result.get("safety_feedback")
    assert payload["contractVersion"] == "7.0"
    assert set(payload["stones"]) == set(AI_ANALYTICS_DIMENSION_IDS)
    assert payload["overallSummaryOutcome"] == "deterministic_fallback"
    # The metric batch is never asked for: eight calls a 6.0 round makes and
    # the contract would then refuse.
    assert "metric_insights" not in calls
    for dimension_id, stone in payload["stones"].items():
        assert "psychologicalInterpretation" not in stone, dimension_id
        assert len(stone["summary"]) == 3, dimension_id
        assert len(stone["recommendedInterventions"]) == 5, dimension_id
        assert "metricInsightsOutcome" not in stone["generationProvenance"]
        for metric in stone["metrics"]:
            assert "insightText" not in metric, dimension_id
            assert metric["scaleId"] in {"likert-5-extent", "likert-7-frequency"}
            assert metric["polarity"] in {"positive", "negative"}
            assert "scoreDistribution" in metric
    assert stone_map_refusal(payload) is None


@pytest.mark.asyncio
async def test_a_v7_round_echoes_exactly_the_scale_it_was_given(monkeypatch):
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 1, "http_503"),
    )
    given = build_v7_input_payload()
    round_data = RoundAnalyticsResult.from_dict(given).to_dict()

    payload = (await analytics_graph.ainvoke(_state(round_data)))["final_payload"]

    echoed = {
        metric["questionId"]: (metric["scaleId"], metric["polarity"])
        for stone in payload["stones"].values()
        for metric in stone["metrics"]
    }
    assert echoed == {
        question_id: (aggregate["scaleId"], aggregate["polarity"])
        for question_id, aggregate in given["questionAggregates"].items()
    }


def _v7_stone_map():
    """A payload the outgoing gate accepts, built from the fallback path."""
    import asyncio

    async def run():
        round_data = RoundAnalyticsResult.from_dict(
            build_v7_input_payload(),
        ).to_dict()
        return (await analytics_graph.ainvoke(_state(round_data)))["final_payload"]

    return run


@pytest.mark.asyncio
async def test_the_outgoing_gate_refuses_a_narrative_on_a_v7_metric(monkeypatch):
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 1, "http_503"),
    )
    payload = await _v7_stone_map()()
    assert stone_map_refusal(payload) is None

    stone = payload["stones"][AI_ANALYTICS_DIMENSION_IDS[0]]
    stone["metrics"][0]["insightText"] = narrative("הטקסט מתאר את המצב.")
    refusal = outgoing_refusal(payload)
    assert refusal.rule == "v7_metric_insight_forbidden"
    # Not copy a replay could fix: the model was never asked for it.
    assert refusal.repairable is False


@pytest.mark.asyncio
async def test_the_outgoing_gate_refuses_a_v7_metric_that_lost_its_scale(monkeypatch):
    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        lambda **_kwargs: (None, 1, "http_503"),
    )
    payload = await _v7_stone_map()()

    stone = payload["stones"][AI_ANALYTICS_DIMENSION_IDS[1]]
    del stone["metrics"][0]["polarity"]
    assert stone_map_refusal(payload) == "v7_answer_scale_missing"


def test_the_outgoing_gate_refuses_metric_provenance_on_v7():
    # `metricInsightsOutcome` describes copy 7.0 does not carry.
    from src.schemas.stone_map_validation import has_valid_metric_insights_outcome

    assert has_valid_metric_insights_outcome(
        {"outcome": "llm", "metricInsightsOutcome": "llm"},
        AI_ANALYTICS_V7_CONTRACT_VERSION,
    ) is False
    assert has_valid_metric_insights_outcome(
        {"outcome": "llm"},
        AI_ANALYTICS_V7_CONTRACT_VERSION,
    ) is True
