"""A whole round written by a generator the graph was handed.

The nodes used to call `llm_provider_service` by name, so the only way to put
different copy in front of the pipeline was to reach into that singleton and
patch it. Here the graph is built with a generator instead, and the singleton's
five generating methods are wired to raise: if any of them is reached, the
round fails and this test says so.
"""

import pytest

from src.agents.graph import AnalyticsGraphEngine
from src.agents.state import AnalyticsState
from src.mcp_client.mock_server import mock_mcp_server
from src.services.llm_provider import InterpretationGeneration, llm_provider_service

GENERATING_METHODS = (
    "generate_psychological_interpretation_result",
    "generate_structured_summary_result",
    "generate_metric_insights_result",
    "generate_overall_summary",
    "adapt_interventions_result",
)


class RecordingGenerator:
    """Deterministic Hebrew about the round's own numbers, and a log of asks.

    The copy comes from the provider's aggregate-grounded fallback text, the
    same choice `tests/llm_stub.py` makes and for the same reason: the safety
    validator stays meaningful because the sentences really describe this
    round. Only their origin is a stub — no prompt, no model, no network.
    """

    def __init__(self):
        self.asked = []

    def generate_psychological_interpretation_result(
        self,
        *,
        dim_id,
        dim_hebrew,
        score,
        status,
        question_aggregates=None,
        **_kwargs,
    ):
        self.asked.append(("interpretation", dim_id))
        return InterpretationGeneration(
            text=llm_provider_service._heuristic_fallback(
                dim_hebrew,
                score,
                status,
                llm_provider_service._normalize_question_aggregates(
                    dim_id,
                    question_aggregates,
                ),
            ),
            outcome="llm",
            attempts=1,
        )

    def generate_overall_summary(self, *, dim_scores, **_kwargs):
        self.asked.append(("overall_summary", None))
        return (
            "התמונה הכללית של הסבב יציבה ברוב המימדים. "
            "מומלץ להמשיך במעקב אחר המימדים החלשים יותר."
        )

    def generate_structured_summary_result(self, **_kwargs):  # pragma: no cover
        raise AssertionError("4.0 does not ask for a structured summary")

    def generate_metric_insights_result(self, **_kwargs):  # pragma: no cover
        raise AssertionError("4.0 does not ask for metric insights")

    def adapt_interventions_result(self, **_kwargs):  # pragma: no cover
        raise AssertionError("4.0 does not adapt interventions")


@pytest.fixture
def unreachable_provider(monkeypatch):
    """Make every generating method of the singleton fail loudly."""

    def refuse(*_args, **_kwargs):
        raise AssertionError(
            "the graph reached the provider singleton instead of its generator"
        )

    for name in GENERATING_METHODS:
        monkeypatch.setattr(llm_provider_service, name, refuse)


@pytest.mark.asyncio
async def test_the_graph_writes_a_round_with_the_generator_it_was_given(
    unreachable_provider,
):
    round_data = mock_mcp_server.get_round_analytics("round-unlocked-sample")
    state: AnalyticsState = {
        "round_data": round_data.model_dump(),
        "org_context": round_data.organizationContext or {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }
    generator = RecordingGenerator()

    final_state = await AnalyticsGraphEngine(generator=generator).ainvoke(state)

    payload = final_state["final_payload"]
    assert payload["status"] == "success"
    assert payload["stones"]
    # Every dimension of the map was asked for, plus the round summary.
    assert ("overall_summary", None) in generator.asked
    assert {dim_id for kind, dim_id in generator.asked if kind == "interpretation"} == (
        set(payload["stones"])
    )


@pytest.mark.asyncio
async def test_the_default_graph_still_uses_the_provider(answering_llm):
    """The default composition is unchanged: no generator means the real one."""
    round_data = mock_mcp_server.get_round_analytics("round-unlocked-sample")
    state: AnalyticsState = {
        "round_data": round_data.model_dump(),
        "org_context": round_data.organizationContext or {},
        "interpretations": {},
        "recommendations": {},
        "safety_status": "pending",
        "safety_feedback": None,
        "retry_count": 0,
        "final_payload": {},
    }

    final_state = await AnalyticsGraphEngine().ainvoke(state)

    assert final_state["final_payload"]["status"] == "success"
