"""What a replay writes again, and what it leaves alone.

The safety loop reaches for the heavy model, whose free tier allows twenty
requests a day. A replay used to rewrite the whole round — eight
interpretations, the summary and eight adaptations — to repair the one stone the
validator turned away, so a single replay spent seventeen of that day's twenty
and four of them exhausted the tier. These tests hold the replay to the
dimensions and the parts that were actually rejected.
"""

import pytest

from src.agents.graph import analytics_graph
from src.agents.nodes import agent_psychologist_node
from src.contracts import AI_ANALYTICS_DIMENSION_IDS
from src.services.llm_provider import (
    AdaptedIntervention,
    ProviderUnavailableError,
    llm_provider_service,
)

from tests.llm_stub import _answer_dimension, _answer_summary
from tests.test_contract_v5 import (
    ADAPTED_STEP,
    ADAPTED_SUMMARY,
    build_state,
    build_v5_round_data,
)

# Copy no Hebrew validator can accept, which is how a test makes the safety
# validator reject exactly one part of a round.
REFUSED_COPY = "This paragraph is not Hebrew and never passes."


class Calls:
    """Who was asked for what, on which tier."""

    def __init__(self):
        self.interpretations = []
        self.adaptations = []
        self.summaries = []

    def interpretations_of(self, dimension_id):
        return [
            tier
            for dim_id, tier in self.interpretations
            if dim_id == dimension_id
        ]

    def heavy_interpretations(self):
        return [
            dim_id for dim_id, tier in self.interpretations if tier == "heavy"
        ]


def _install(
    monkeypatch,
    *,
    bad_interpretation_for=(),
    bad_adaptation_for=(),
    bad_summaries=0,
    unavailable_interpretation_for=(),
):
    """Patch the three model-written calls and record every one of them.

    A dimension named in `bad_*` is answered with copy the validator refuses on
    the first pass only, so a replay that repairs it can be observed. One named
    in `unavailable_interpretation_for` refuses on every pass after the first,
    which is how a replay that fails again is observed.
    """
    calls = Calls()

    def interpretation(*, dim_id, retry_tier="fast", **kwargs):
        calls.interpretations.append((dim_id, retry_tier))
        first_call = len(calls.interpretations_of(dim_id)) == 1
        if dim_id in bad_interpretation_for and first_call:
            return type(
                "Refused",
                (),
                {"text": REFUSED_COPY, "outcome": "llm", "attempts": 1},
            )()
        if dim_id in unavailable_interpretation_for and not first_call:
            raise ProviderUnavailableError(
                "invalid_semantic_output",
                dimension_id=dim_id,
                attempts=1,
            )
        if dim_id in unavailable_interpretation_for and first_call:
            return type(
                "Refused",
                (),
                {"text": REFUSED_COPY, "outcome": "llm", "attempts": 1},
            )()
        return _answer_dimension(dim_id=dim_id, retry_tier=retry_tier, **kwargs)

    def summary(*, retry_tier="fast", **kwargs):
        calls.summaries.append(retry_tier)
        if len(calls.summaries) <= bad_summaries:
            return REFUSED_COPY
        return _answer_summary(retry_tier=retry_tier, **kwargs)

    def adaptation(
        *,
        interventions,
        dim_hebrew,
        score,
        status,
        question_aggregates=None,
        background_context=None,
        retry_tier="fast",
    ):
        dimension_id = interventions[0]["dimensionId"]
        calls.adaptations.append((dimension_id, retry_tier))
        first_call = len(
            [
                dim_id
                for dim_id, _ in calls.adaptations
                if dim_id == dimension_id
            ],
        ) == 1
        summary_text = (
            REFUSED_COPY
            if dimension_id in bad_adaptation_for and first_call
            else ADAPTED_SUMMARY
        )
        return [
            AdaptedIntervention(
                summary=summary_text,
                actionable_steps=[ADAPTED_STEP]
                * len(intervention["actionable_steps"]),
                outcome="llm",
                attempts=1,
            )
            for intervention in interventions
        ]

    monkeypatch.setattr(
        llm_provider_service,
        "generate_psychological_interpretation_result",
        interpretation,
    )
    monkeypatch.setattr(
        llm_provider_service,
        "generate_overall_summary",
        summary,
    )
    monkeypatch.setattr(
        llm_provider_service,
        "adapt_interventions_result",
        adaptation,
    )
    return calls


DIMENSIONS = len(AI_ANALYTICS_DIMENSION_IDS)


@pytest.mark.asyncio
async def test_a_replay_writes_only_the_interpretation_that_was_rejected(
    monkeypatch,
):
    """The item, stated as a number: one heavy request, not seventeen.

    `retry_tier` switches the whole node to the heavy model, so what the replay
    asks for is exactly what the heavy tier's daily twenty pays for.
    """
    calls = _install(monkeypatch, bad_interpretation_for={"balance"})

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )
    payload = final_state["final_payload"]

    assert payload["status"] == "success"
    assert calls.heavy_interpretations() == ["balance"]
    assert len(calls.interpretations) == DIMENSIONS + 1
    # The summary and the adaptations are written from the scores and the
    # catalog, neither of which a replay changes.
    assert len(calls.summaries) == 1
    assert len(calls.adaptations) == DIMENSIONS
    assert all(tier == "fast" for _, tier in calls.adaptations)


@pytest.mark.asyncio
async def test_the_dimensions_that_passed_keep_their_text_and_their_attempts(
    monkeypatch,
):
    """A kept stone is the stone the validator accepted, attempt count and all.

    Rewriting the provenance of a dimension nobody asked about would report a
    round that never happened — and `retryCount` has to keep agreeing with
    `attempts`, which Core checks.
    """
    calls = _install(monkeypatch, bad_interpretation_for={"balance"})

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )
    stones = final_state["final_payload"]["stones"]

    assert stones["balance"]["generationProvenance"]["attempts"] == 2
    assert stones["balance"]["generationProvenance"]["retryCount"] == 1
    assert stones["balance"]["psychologicalInterpretation"] != ""
    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        if dimension_id == "balance":
            continue
        provenance = stones[dimension_id]["generationProvenance"]
        assert provenance["attempts"] == 1, dimension_id
        assert provenance["retryCount"] == 0, dimension_id
        assert provenance["outcome"] == "llm", dimension_id
        assert stones[dimension_id]["psychologicalInterpretation"] != ""
        assert calls.interpretations_of(dimension_id) == ["fast"]


@pytest.mark.asyncio
async def test_a_rejected_rewrite_replays_that_dimension_and_nothing_else(
    monkeypatch,
):
    """A refused adaptation is not a reason to write eight interpretations.

    The two halves of a stone fail independently: an adaptation is written from
    the aggregates and the catalog entry, an interpretation from the aggregates
    alone, and neither reads the other.
    """
    calls = _install(monkeypatch, bad_adaptation_for={"meaning"})

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )
    payload = final_state["final_payload"]

    assert payload["status"] == "success"
    assert len(calls.adaptations) == DIMENSIONS + 1
    assert [
        dim_id for dim_id, tier in calls.adaptations if tier == "heavy"
    ] == ["meaning"]
    assert len(calls.interpretations) == DIMENSIONS
    assert len(calls.summaries) == 1
    for interventions in final_state["recommendations"].values():
        for intervention in interventions:
            assert intervention["adaptationOutcome"] == "llm"
            assert intervention["summary"] == ADAPTED_SUMMARY


@pytest.mark.asyncio
async def test_a_rejected_summary_replays_the_summary_alone(monkeypatch):
    """The round summary is one request, and it is the one that was refused."""
    calls = _install(monkeypatch, bad_summaries=1)

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )

    assert final_state["final_payload"]["status"] == "success"
    assert calls.summaries == ["fast", "heavy"]
    assert len(calls.interpretations) == DIMENSIONS
    assert len(calls.adaptations) == DIMENSIONS


@pytest.mark.asyncio
async def test_an_untargeted_replay_still_writes_the_whole_round(monkeypatch):
    """A rejection that names nothing must not become a replay that does nothing.

    The narrow replay is driven by what the validator recorded. If a check ever
    fails without naming its dimension, the round has to fall back to the old
    whole-node replay rather than loop over an empty plan.
    """
    calls = _install(monkeypatch)
    state = build_state(build_v5_round_data())
    state["retry_count"] = 1
    state["interpretations"] = {
        "overall_summary": "כבר נכתב",
        "dimension_interpretations": {
            dimension_id: "כבר נכתב" for dimension_id in AI_ANALYTICS_DIMENSION_IDS
        },
    }

    await agent_psychologist_node(state)

    assert len(calls.interpretations) == DIMENSIONS
    assert calls.heavy_interpretations() == list(
        dict.fromkeys(dim_id for dim_id, _ in calls.interpretations),
    )
    assert len(calls.summaries) == 1


@pytest.mark.asyncio
async def test_a_replay_that_fails_again_leaves_the_other_stones_standing(
    monkeypatch,
):
    """One dimension replayed and refused is a gap, not a dead round.

    The partial map asks whether anything at all was written, and it has to ask
    that of the whole map rather than of the replay: a pass that carries one
    dimension and fails it would otherwise read as a round where the provider
    answered nothing.
    """
    calls = _install(
        monkeypatch,
        unavailable_interpretation_for={"certainty"},
    )

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )
    payload = final_state["final_payload"]

    assert payload["status"] == "success"
    assert payload["dimensionsWithoutInterpretation"] == ["certainty"]
    assert payload["stones"]["certainty"]["psychologicalInterpretation"] == ""
    assert (
        payload["stones"]["certainty"]["generationProvenance"]["outcome"]
        == "unavailable"
    )
    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        if dimension_id == "certainty":
            continue
        assert payload["stones"][dimension_id][
            "psychologicalInterpretation"
        ] != ""
    assert calls.heavy_interpretations() == ["certainty"]
