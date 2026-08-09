"""What a replay is told about the attempt that was refused.

The safety validator already narrowed a replay to the parts that failed, but it
could not say why: the joined sentence it wrote into `safety_feedback` was read
by nothing, so a rejected dimension was asked again with a byte-identical prompt
on a costlier model. These tests hold the critique to three things — it reaches
the prompt of the part that failed, it reaches nothing else, and it says nothing
about this service's own bookkeeping.
"""

import pytest

from src.agents.graph import analytics_graph
from src.agents.node_support import _repair_critique
from src.agents.safety_report import critique, violation
from src.services import hebrew_prompts
from src.services.llm_provider import llm_provider_service

from tests.test_contract_v5 import build_state, build_v5_round_data
from tests.test_replay_targets import _install


def _critiques_for(pairs, dimension_id):
    return [value for dim_id, value in pairs if dim_id == dimension_id]


def _adaptation_prompt(monkeypatch, *, contract_version, repair_critique):
    """The adaptation prompt this contract version would really have sent.

    The node's keyword argument is not the thing under test — every version
    receives it. What differs is whether the branch that builds the prompt
    still carries it, so the assertion has to read the rendered prompt.
    """
    captured = {}

    def capture(*, build_prompt, **_kwargs):
        # The first in-call attempt: no transport critique yet, so whatever
        # reaches the prompt here came from the replay.
        captured["prompt"] = build_prompt()
        return (None, 1, "captured")

    monkeypatch.setattr(
        llm_provider_service,
        "_complete_with_retries",
        capture,
    )
    llm_provider_service.adapt_interventions_result(
        interventions=[
            {
                "id": "kb-bala-y-01",
                "dimensionId": "balance",
                "status": "yellow",
                "title": "חלונות מוגנים לעבודה ממוקדת",
                "summary": "מהלך מעשי לצמצום עומס בשבוע העבודה.",
                "actionable_steps": ["לקבוע חלון מוגן", "לבדוק את ההשפעה"],
            },
        ],
        dim_hebrew="איזון",
        score=60.0,
        status="yellow",
        question_aggregates=[],
        contract_version=contract_version,
        repair_critique=repair_critique,
    )
    return captured["prompt"]


def test_a_first_attempt_carries_no_critique():
    """Nothing was refused yet, so there is nothing to correct."""
    assert critique((), "interpretation", "balance") is None
    assert _repair_critique({"retry_count": 0}, "interpretation") is None


def test_a_stale_report_cannot_leak_into_a_first_pass():
    """`retry_count` decides, not the presence of a report in the state.

    A round whose state still carries violations from an earlier attempt must
    not open its first prompt with a correction of something this attempt has
    not written.
    """
    state = {
        "retry_count": 0,
        "safety_violations": [
            violation("interpretation_invalid", "interpretation", "balance"),
        ],
    }

    assert _repair_critique(state, "interpretation", "balance") is None


def test_the_critique_reaches_only_the_part_that_was_refused():
    """A refusal names a target and a dimension, and stops there."""
    violations = [
        violation("interpretation_invalid", "interpretation", "balance"),
        violation("intervention_invalid", "recommendation", "meaning"),
        violation("overall_summary_not_hebrew", "overall_summary"),
    ]

    assert critique(violations, "interpretation", "balance") is not None
    assert critique(violations, "interpretation", "meaning") is None
    assert critique(violations, "recommendation", "balance") is None
    assert critique(violations, "recommendation", "meaning") is not None
    assert critique(violations, "overall_summary") is not None


def test_our_own_bookkeeping_is_never_handed_to_the_model():
    """Provenance and the catalog count are not the model's mistakes.

    Both refusals describe records this service writes — which questions fed a
    prompt, how many catalog entries a dimension has. Turning either into a
    correction would ask the model to repair a step it never performed, and the
    words would land in a manager's copy.
    """
    bookkeeping = [
        violation("provenance_invalid", "interpretation", "balance"),
        violation("unavailable_not_empty", "interpretation", "balance"),
        violation("v6_intervention_count", "recommendation", "balance"),
    ]

    assert critique(bookkeeping, "interpretation", "balance") is None
    assert critique(bookkeeping, "recommendation", "balance") is None


def test_two_refusals_of_one_part_are_stated_once_each():
    """A repeated code says nothing twice; two distinct codes both survive."""
    repeated = critique(
        [
            violation("status_inconsistent", "interpretation", "balance"),
            violation("status_inconsistent", "interpretation", "balance"),
        ],
        "interpretation",
        "balance",
    )
    both = critique(
        [
            violation("status_inconsistent", "interpretation", "balance"),
            violation("interpretation_invalid", "interpretation", "balance"),
        ],
        "interpretation",
        "balance",
    )

    assert repeated is not None and repeated.count("עקביות") == 1
    assert both is not None and len(both) > len(repeated)


def test_the_prompt_without_a_critique_is_the_prompt_it_has_always_been():
    """A first attempt must not pay for the repair path in tokens or wording."""
    assert hebrew_prompts.repair_section(None) == ""
    assert hebrew_prompts.repair_section("") == ""

    arguments = {
        "dim_id": "balance",
        "dim_hebrew": "איזון",
        "score": 55.0,
        "status": "yellow",
        "question_aggregates": [],
    }
    assert hebrew_prompts.interpretation_prompt(
        **arguments,
    ) == hebrew_prompts.interpretation_prompt(**arguments, repair_critique=None)


def test_the_critique_is_appended_after_the_rules_it_qualifies():
    """The correction is read against the rules, so it comes last."""
    correction = "כתוב מחדש בעברית בלבד."
    plain = hebrew_prompts.interpretation_prompt(
        dim_id="balance",
        dim_hebrew="איזון",
        score=55.0,
        status="yellow",
        question_aggregates=[],
    )
    repaired = hebrew_prompts.interpretation_prompt(
        dim_id="balance",
        dim_hebrew="איזון",
        score=55.0,
        status="yellow",
        question_aggregates=[],
        repair_critique=correction,
    )

    assert repaired.startswith(plain)
    assert repaired.endswith(correction)


@pytest.mark.asyncio
async def test_a_replayed_interpretation_is_told_what_was_wrong(monkeypatch):
    """The item, end to end: the heavy call knows why the fast one was refused.

    The first pass over every dimension carries `None`, and the one replay —
    the dimension the validator turned away — carries a Hebrew correction.
    """
    calls = _install(monkeypatch, bad_interpretation_for={"balance"})

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )

    assert final_state["final_payload"]["status"] == "success"
    balance = _critiques_for(calls.interpretation_critiques, "balance")
    assert len(balance) == 2
    assert balance[0] is None
    assert balance[1] is not None
    assert "עברית" in balance[1] or "עקביות" in balance[1]
    for dim_id, value in calls.interpretation_critiques:
        if dim_id != "balance":
            assert value is None, dim_id


@pytest.mark.asyncio
async def test_a_replayed_adaptation_is_told_what_was_wrong(monkeypatch):
    """A refused recommendation is corrected as a recommendation."""
    calls = _install(monkeypatch, bad_adaptation_for={"meaning"})

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )

    assert final_state["final_payload"]["status"] == "success"
    meaning = _critiques_for(calls.adaptation_critiques, "meaning")
    assert len(meaning) == 2
    assert meaning[0] is None
    assert meaning[1] is not None
    # A refused recommendation says nothing about the interpretation of the
    # same dimension: the two are written from different inputs.
    assert all(
        value is None for _, value in calls.interpretation_critiques
    )


@pytest.mark.parametrize("contract_version", ["5.0", "6.0"])
def test_a_replayed_adaptation_carries_the_critique_into_its_prompt(
    monkeypatch,
    contract_version,
):
    """Every version that adapts must put the replay's critique in the prompt.

    `test_a_replayed_adaptation_is_told_what_was_wrong` stops one step short of
    this: it stubs the generator, so it sees the keyword argument the node
    passes and not what the prompt builder does with it. `6.0` took that
    argument and dropped it — the branch built its prompt from the transport's
    own retry critique alone — so a dimension the validator refused was asked
    again on the heavy model with no idea what had been wrong. Both branches
    are parameterised here because one of them silently stopped obeying a rule
    the other kept.
    """
    correction = critique(
        [violation("intervention_invalid", "recommendation", "balance")],
        "recommendation",
        "balance",
    )
    assert correction is not None

    plain = _adaptation_prompt(
        monkeypatch,
        contract_version=contract_version,
        repair_critique=None,
    )
    repaired = _adaptation_prompt(
        monkeypatch,
        contract_version=contract_version,
        repair_critique=correction,
    )

    assert correction in repaired
    # Same placement rule as every other prompt: the correction is appended
    # after the rules it qualifies, so a first attempt pays nothing for it.
    assert repaired.startswith(plain)


@pytest.mark.asyncio
async def test_a_replayed_summary_is_told_what_was_wrong(monkeypatch):
    """The round summary is one request, and it learns from its own refusal."""
    calls = _install(monkeypatch, bad_summaries=1)

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )

    assert final_state["final_payload"]["status"] == "success"
    assert calls.summary_critiques[0] is None
    assert calls.summary_critiques[1] is not None
    assert "עברית" in calls.summary_critiques[1]
