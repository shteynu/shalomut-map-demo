"""Re-running one dimension without re-running the round.

A manager who reads that one dimension's paragraphs were composed from the
numbers had one move: re-run the analysis, which re-ran all eight and spent
eight dimensions' worth of provider calls to fix one. Core can now name the
dimensions a run has to write again, and these hold the service to it: the
named ones are asked for, the rest keep the copy they already have, and what
comes back is still a whole map — every stone, every number recomputed — so
neither the callback contract nor Core's verification of it changes at all.
"""

import pytest

from src.agents.graph import analytics_graph
from src.agents.nodes import _replay_plan
from src.agents.state import build_initial_state, carried_state_from_result
from src.contracts import AI_ANALYTICS_DIMENSION_IDS

from tests.test_contract_v5 import build_state, build_v5_round_data
from tests.test_replay_targets import _install


DIMENSIONS = len(AI_ANALYTICS_DIMENSION_IDS)


def _partial_state(round_data, previous_result, regenerate):
    return build_initial_state(
        round_data=round_data,
        org_context={},
        regenerate_dimension_ids=regenerate,
        previous_result=previous_result,
    )


@pytest.mark.asyncio
async def test_a_partial_run_asks_only_for_the_dimensions_it_was_given(
    monkeypatch,
):
    """The whole point, stated as a number: one interpretation, not eight."""
    calls = _install(monkeypatch)
    round_data = build_v5_round_data()

    first = await analytics_graph.ainvoke(build_state(round_data))
    previous = first["final_payload"]
    assert previous["status"] == "success"
    assert len(calls.interpretations) == DIMENSIONS

    second = await analytics_graph.ainvoke(
        _partial_state(round_data, previous, ["balance"]),
    )

    written_again = [
        dim_id for dim_id, _ in calls.interpretations[DIMENSIONS:]
    ]
    assert written_again == ["balance"]
    # The round sentence is written from every dimension at once, so it is
    # never carried: last round's sentence over a rewritten dimension is the
    # one carried thing that would no longer be true.
    assert len(calls.summaries) == 2
    assert second["final_payload"]["status"] == "success"


@pytest.mark.asyncio
async def test_a_partial_run_still_delivers_a_whole_map(monkeypatch):
    """Eight stones, and the seven it did not write are the seven it kept.

    Core recomputes every score, status and aggregate before it stores a
    result, so a partial run that returned seven stones — or eight stones with
    one dimension's numbers left as they were — would be refused. What travels
    is a full map whose numbers all come from this run's own aggregates.
    """
    calls = _install(monkeypatch)
    round_data = build_v5_round_data()

    previous = (await analytics_graph.ainvoke(build_state(round_data)))[
        "final_payload"
    ]
    kept = {
        dimension_id: previous["stones"][dimension_id]["psychologicalInterpretation"]
        for dimension_id in AI_ANALYTICS_DIMENSION_IDS
        if dimension_id != "balance"
    }

    payload = (
        await analytics_graph.ainvoke(
            _partial_state(round_data, previous, ["balance"]),
        )
    )["final_payload"]

    assert set(payload["stones"]) == set(AI_ANALYTICS_DIMENSION_IDS)
    for dimension_id, interpretation in kept.items():
        assert payload["stones"][dimension_id]["psychologicalInterpretation"] == (
            interpretation
        ), dimension_id
        # The provenance is kept with the copy it describes. Rewriting it would
        # report a round that never happened.
        assert payload["stones"][dimension_id]["generationProvenance"] == (
            previous["stones"][dimension_id]["generationProvenance"]
        ), dimension_id

    # Every number still comes from this run's aggregates, not from the map it
    # amended — the formatter reads them from `round_data` for kept and
    # rewritten dimensions alike.
    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        assert (
            payload["stones"][dimension_id]["score"]
            == previous["stones"][dimension_id]["score"]
        )
    assert len(calls.interpretations) == DIMENSIONS + 1


@pytest.mark.asyncio
async def test_a_run_that_names_nothing_is_the_round_it_always_was(monkeypatch):
    """The ordinary run, and every run written before this existed."""
    calls = _install(monkeypatch)
    round_data = build_v5_round_data()

    state = build_initial_state(round_data=round_data, org_context={})

    assert state["regenerate_dimension_ids"] == []
    assert _replay_plan(state) is None

    payload = (await analytics_graph.ainvoke(state))["final_payload"]

    assert payload["status"] == "success"
    assert len(calls.interpretations) == DIMENSIONS


@pytest.mark.asyncio
async def test_naming_dimensions_with_no_previous_map_analyses_the_round(
    monkeypatch,
):
    """There is nothing to carry, so there is nothing partial about it.

    Core refuses to queue this combination — a partial run needs a map to
    amend — and the service stays correct rather than trusting that it always
    will.
    """
    calls = _install(monkeypatch)
    round_data = build_v5_round_data()

    state = build_initial_state(
        round_data=round_data,
        org_context={},
        regenerate_dimension_ids=["balance"],
        previous_result=None,
    )

    assert state["regenerate_dimension_ids"] == []
    payload = (await analytics_graph.ainvoke(state))["final_payload"]

    assert payload["status"] == "success"
    assert len(calls.interpretations) == DIMENSIONS


def test_the_plan_a_partial_run_makes_is_not_a_retry():
    """Same mechanism, different event, and the plan says which.

    A replay writes again what the validator refused; a partial run writes
    again what a manager asked for. The nodes need one answer from both, so
    they share `ReplayPlan` — but nothing here is a retry, and `retry_count`
    stays at zero so the heavy tier is not spent on a first pass.
    """
    state = build_initial_state(
        round_data=build_v5_round_data(),
        org_context={},
        regenerate_dimension_ids=["balance", "certainty"],
        previous_result={"stones": {"balance": {}, "certainty": {}}},
    )
    plan = _replay_plan(state)

    assert state["retry_count"] == 0
    assert plan is not None
    assert plan.interpretations == frozenset({"balance", "certainty"})
    assert plan.recommendations == frozenset({"balance", "certainty"})
    assert plan.overall_summary is True


def test_only_the_writing_is_carried_never_a_number():
    """What `carried_state_from_result` takes, and what it deliberately drops.

    A carried stone is last round's words over today's figures. Taking the
    numbers too would produce a map Core refuses, because Core recomputes them.
    """
    previous = {
        "stones": {
            "balance": {
                "score": 41.0,
                "status": "red",
                "psychologicalInterpretation": "פסקה שהמודל כתב.",
                "summary": ["ראשונה.", "שנייה.", "שלישית."],
                "metrics": [
                    {
                        "questionId": "balance-q1",
                        "averageScore": 41.0,
                        "insightText": "משפט על ההתפלגות.",
                    },
                    {"questionId": None, "insightText": "לא נשמר."},
                ],
                "recommendedInterventions": [{"id": "one", "status": "red"}],
                "generationProvenance": {"outcome": "llm", "attempts": 1},
            },
        },
    }

    carried = carried_state_from_result(previous, ["balance"])

    assert carried["interpretations"]["dimension_interpretations"] == {
        "balance": "פסקה שהמודל כתב.",
    }
    assert carried["interpretations"]["dimension_summaries"]["balance"] == [
        "ראשונה.",
        "שנייה.",
        "שלישית.",
    ]
    # Keyed by question, and a metric with no question id is not a metric any
    # aggregate can be matched to.
    assert carried["interpretations"]["metric_insights"]["balance"] == {
        "balance-q1": "משפט על ההתפלגות.",
    }
    assert carried["recommendations"]["balance"] == [
        {"id": "one", "status": "red"},
    ]
    assert carried["generation_provenance"]["balance"] == {
        "outcome": "llm",
        "attempts": 1,
    }
    # Nothing numeric came across, at any depth.
    assert "score" not in str(carried)


def test_a_dimension_the_previous_map_lacks_is_regenerated_not_invented():
    carried = carried_state_from_result({"stones": {}}, ["balance"])

    assert carried["generation_provenance"] == {}
    assert carried["interpretations"]["dimension_interpretations"] == {}
