from typing import get_type_hints

from src.agents.state import (
    AnalyticsState,
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
