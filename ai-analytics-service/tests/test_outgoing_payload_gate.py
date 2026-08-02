"""What happens to a payload the safety validator passed and Core would refuse.

The safety validator judges the state — the copy each node wrote. Nothing
judged the assembled payload, so a round could pass every check in the service
and be refused at the callback, where the model calls are already paid for and
the retry loop has long since finished. These tests hold the gate to two
behaviours: copy a second attempt could fix is replayed, and a refusal no
replay can fix ends the round immediately instead of buying a heavy-tier
request to produce the same refusal.
"""

import pytest

from src.agents.graph import analytics_graph
from src.schemas.stone_map_validation import outgoing_refusal

from tests.llm_stub import _answer_dimension, _answer_summary
from tests.test_contract_v5 import build_state, build_v5_round_data
from tests.test_replay_targets import _install

# Hebrew, so the safety validator takes it, and one sentence, so Core does not:
# 5.0 asks the round summary for two to four.
ONE_SENTENCE_SUMMARY = "התמונה הכללית יציבה."


def _summary_stub(calls, bad_first):
    def summary(*, retry_tier="fast", repair_critique=None, **kwargs):
        calls.append((retry_tier, repair_critique))
        if len(calls) <= bad_first:
            return ONE_SENTENCE_SUMMARY
        return _answer_summary(retry_tier=retry_tier, **kwargs)

    return summary


def test_every_repairable_rule_has_something_to_say_to_the_model():
    """A replay with no critique asks the identical question on a costlier model.

    This is not hypothetical: the first draft of the gate replayed
    `summary_sentence_count` with an empty critique, because the codes it emits
    come from the payload validator and the critique table only knew the safety
    validator's. Adding a rule to `_REPAIRABLE` without a line here would bring
    that back silently.
    """
    from src.agents.safety_report import _CRITIQUES
    from src.schemas.stone_map_validation import _REPAIRABLE

    assert [rule for rule in _REPAIRABLE if rule not in _CRITIQUES] == []


def test_the_gate_classifies_what_a_replay_could_fix():
    """Copy is repairable; a hash that never arrived is not."""
    assert outgoing_refusal({"contractVersion": "9.9"}).repairable is False

    payload = {
        "contractVersion": "5.0",
        "status": "success",
        "surveyDefinitionHash": f"sha256:{'a' * 64}",
        "overallPsychologicalSummary": ONE_SENTENCE_SUMMARY,
        "stones": {},
    }
    refusal = outgoing_refusal(payload)
    assert refusal.rule == "summary_sentence_count"
    assert refusal.repairable is True
    assert refusal.target == "overall_summary"


@pytest.mark.asyncio
async def test_a_summary_core_would_refuse_is_written_again(monkeypatch):
    """The item: the round survives instead of dying at the callback.

    The safety validator has no opinion on sentence count, so without the gate
    this payload leaves the service, Core refuses it, and the whole round of
    model calls is spent for a failed run.
    """
    calls = _install(monkeypatch)
    summaries = []
    monkeypatch.setattr(
        __import__("src.services.llm_provider", fromlist=["llm_provider_service"]).llm_provider_service,
        "generate_overall_summary",
        _summary_stub(summaries, bad_first=1),
    )

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )
    payload = final_state["final_payload"]

    assert payload["status"] == "success"
    assert payload["overallPsychologicalSummary"] != ONE_SENTENCE_SUMMARY
    # Written twice, and the second attempt was told what was wrong with the
    # first rather than being asked the same question on a costlier model.
    assert len(summaries) == 2
    assert summaries[0] == ("fast", None)
    assert summaries[1][0] == "heavy"
    assert summaries[1][1] is not None
    # Only the summary is replayed: nothing about the stones was refused.
    assert len(calls.interpretations) == 8
    assert len(calls.adaptations) == 8


@pytest.mark.asyncio
async def test_a_refusal_no_replay_can_fix_ends_the_round_at_once(monkeypatch):
    """A missing hash arrived in the round data; regenerating cannot conjure one.

    The round fails here, naming the rule, instead of spending three replays to
    reach the identical refusal — and instead of spending them at the callback,
    which is where this used to be discovered.
    """
    calls = _install(monkeypatch)
    round_data = build_v5_round_data()
    del round_data["surveyDefinitionHash"]

    final_state = await analytics_graph.ainvoke(build_state(round_data))
    payload = final_state["final_payload"]

    assert payload["status"] == "validation_failed"
    assert payload["failureReason"] == "outgoing_survey_definition_hash_required"
    # One pass over the round, not four.
    assert len(calls.interpretations) == 8
    assert calls.heavy_interpretations() == []
    assert len(calls.summaries) == 1


@pytest.mark.asyncio
async def test_an_ordinary_round_is_untouched(monkeypatch):
    """The gate is silent when the payload is fine, which is the common case."""
    calls = _install(monkeypatch)

    final_state = await analytics_graph.ainvoke(
        build_state(build_v5_round_data()),
    )

    assert final_state["final_payload"]["status"] == "success"
    assert outgoing_refusal(final_state["final_payload"]) is None
    assert len(calls.interpretations) == 8
    assert len(calls.summaries) == 1
