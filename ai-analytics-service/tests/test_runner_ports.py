"""An analysis run with nothing real behind it.

The point of the ports: the runner can be built out of three objects that have
the right methods and nothing else — no MCP server, no graph, no HTTP. If this
file ever needs a network, a provider or a settings value to pass, a transport
has leaked back into the run.
"""

import pytest

from src.schemas.mcp_types import RoundAnalyticsResult
from src.services.ai_job_worker import create_ai_analysis_job_worker
from src.services.analytics_runner import AnalyticsRunnerService

ROUND_ID = "round-ports-1"

# A locked round: the fewest fields a payload can legitimately have, and the
# graph is a double here anyway. What travels matters, not what it says.
PAYLOAD = {
    "contractVersion": "2.0",
    "roundId": ROUND_ID,
    "isLocked": True,
    "totalResponses": 3,
    "privacyThreshold": 10,
    "dimensionScores": {},
    "questionAggregates": {},
    "calculatedAt": "2026-08-02T09:00:00.000Z",
}


class FakeSource:
    def __init__(self, result):
        self.result = result
        self.requested = []

    async def fetch_round_analytics(self, round_id):
        self.requested.append(round_id)
        return self.result


class FakePipeline:
    def __init__(self, final_payload=None, error=None):
        self.final_payload = final_payload or {}
        self.error = error
        self.states = []

    async def ainvoke(self, state):
        self.states.append(state)
        if self.error:
            raise self.error
        return {**state, "final_payload": self.final_payload}


class FakeSink:
    def __init__(self):
        self.delivered = []

    async def deliver(self, round_id, payload, *, run_id=None, lease_token=None):
        self.delivered.append((round_id, payload, run_id, lease_token))


def build_runner(**overrides):
    source = overrides.pop(
        "source",
        FakeSource(RoundAnalyticsResult.from_dict(dict(PAYLOAD))),
    )
    pipeline = overrides.pop(
        "pipeline",
        FakePipeline({"roundId": ROUND_ID, "status": "success"}),
    )
    sink = overrides.pop("sink", FakeSink())
    return AnalyticsRunnerService(source=source, pipeline=pipeline, sink=sink)


@pytest.mark.asyncio
async def test_a_round_travels_from_source_through_pipeline_to_sink():
    sink = FakeSink()
    runner = build_runner(sink=sink)

    result = await runner.process_round(ROUND_ID)

    assert result == {"roundId": ROUND_ID, "status": "success"}
    assert sink.delivered == [(ROUND_ID, result, None, None)]


@pytest.mark.asyncio
async def test_a_durable_run_carries_its_identity_to_the_sink():
    sink = FakeSink()
    runner = build_runner(sink=sink)

    await runner.process_round(
        ROUND_ID,
        run_id="run-1",
        lease_token="lease-1",
    )

    _round_id, _payload, run_id, lease_token = sink.delivered[0]
    assert (run_id, lease_token) == ("run-1", "lease-1")


@pytest.mark.asyncio
async def test_a_pipeline_that_crashes_still_reaches_the_sink():
    sink = FakeSink()
    pipeline = FakePipeline(error=RuntimeError("pipeline exploded"))
    runner = build_runner(pipeline=pipeline, sink=sink)

    with pytest.raises(RuntimeError, match="pipeline exploded"):
        await runner.process_round(ROUND_ID)

    _round_id, payload, _run_id, _lease_token = sink.delivered[0]
    assert payload["status"] == "validation_failed"
    assert payload["failureReason"] == "service_error"


@pytest.mark.asyncio
async def test_a_round_that_answers_for_a_different_round_never_runs():
    other = dict(PAYLOAD, roundId="round-somebody-else")
    source = FakeSource(RoundAnalyticsResult.from_dict(other))
    pipeline = FakePipeline()
    sink = FakeSink()
    runner = build_runner(source=source, pipeline=pipeline, sink=sink)

    with pytest.raises(RuntimeError, match="round isolation mismatch"):
        await runner.process_round(ROUND_ID)

    assert pipeline.states == []
    assert sink.delivered == []


def test_the_worker_can_be_composed_from_supplied_collaborators():
    runner = build_runner()

    worker = create_ai_analysis_job_worker(client=object(), runner=runner)

    assert worker.runner is runner
