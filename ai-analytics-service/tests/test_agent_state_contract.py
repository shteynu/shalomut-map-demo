import re
from pathlib import Path
from typing import get_args, get_type_hints

from src.agents.state import (
    AnalyticsState,
    SafetyStatus,
    build_initial_state,
    GenerationProvenanceState,
    InterpretationState,
    InterventionState,
    RoundAnalyticsState,
)
from src.agents.nodes import (
    agent_adaptation_node,
    agent_psychologist_node,
    agent_rag_intervention_node,
    agent_safety_validator_node,
    privacy_gate_node,
)


def test_graph_state_uses_named_nested_contracts() -> None:
    hints = get_type_hints(AnalyticsState)

    assert hints["round_data"] is RoundAnalyticsState
    assert hints["interpretations"] is InterpretationState
    assert "GenerationProvenanceState" in str(hints["generation_provenance"])
    assert "InterventionState" in str(hints["recommendations"])


def test_stable_pipeline_records_expose_their_owned_fields() -> None:
    assert set(InterpretationState.__required_keys__) == {
        "overall_summary",
        "dimension_interpretations",
    }
    assert "overall_summary_outcome" in InterpretationState.__optional_keys__
    assert {
        "outcome",
        "attempts",
        "retryCount",
        "sourceQuestionIds",
    }.issubset(GenerationProvenanceState.__optional_keys__)
    assert {
        "dimensionId",
        "status",
        "title",
        "summary",
        "actionable_steps",
        "adaptationOutcome",
    }.issubset(InterventionState.__optional_keys__)


def test_nodes_facade_preserves_imports_across_bounded_modules() -> None:
    assert privacy_gate_node.__module__ == "src.agents.privacy_node"
    assert agent_psychologist_node.__module__ == "src.agents.psychologist_node"
    assert agent_rag_intervention_node.__module__ == (
        "src.agents.intervention_nodes"
    )
    assert agent_adaptation_node.__module__ == "src.agents.intervention_nodes"
    assert agent_safety_validator_node.__module__ == "src.agents.safety_node"


def test_every_safety_status_the_service_writes_is_a_declared_one() -> None:
    """The state contract is advisory, so a test has to be the type checker.

    Nothing runs mypy over this service. `safety_status` was declared with five
    values while both entrypoints started a round on a sixth, `pending`, and no
    test failed. This reads the assignments out of `src/` and holds them to the
    declared alias, so the next value added in one place fails here.
    """
    declared = set(get_args(SafetyStatus))
    source_root = Path(__file__).resolve().parents[1] / "src"
    assigned = {
        match.group(1)
        for path in source_root.rglob("*.py")
        for match in re.finditer(
            r'"safety_status":\s*"([a-z_]+)"',
            path.read_text(encoding="utf-8"),
        )
    }

    assert assigned, "no safety_status assignment found — has the key moved?"
    assert assigned <= declared, sorted(assigned - declared)


def test_a_round_starts_on_the_one_state_that_means_not_judged_yet() -> None:
    state = build_initial_state(round_data={}, org_context={})

    assert state["safety_status"] == "pending"
    assert state["safety_status"] in get_args(SafetyStatus)
    assert state["retry_count"] == 0
    assert state["final_payload"] == {}
