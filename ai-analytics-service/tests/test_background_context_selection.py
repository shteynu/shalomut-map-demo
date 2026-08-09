"""Which object becomes the school's background context, and what it costs.

`_background_context_for_prompt` used to answer
`round_data["backgroundContext"] or state["org_context"]`. The second is the
organization's identity, which the runner never leaves empty, so from `4.0` —
where the capability gate first lets anything through — the `or` never fell
through. Two consequences, and they are not the same shape:

* `backgroundContextIncluded` was `true` on every deployed round from `4.0`,
  including the ones whose school had answered nothing, so the flag could not
  distinguish them. Version-neutral.
* On `6.0` the organization's UUID reached the model. Only there: `4.0` and
  `5.0` render the seven fields they know and ignore the rest, while the three
  `6.0` prompts JSON-dump the object whole.

These live in their own module, parametrised over the versions that declare
the capability, because pinning them to one version's file is what let the
second consequence go untested — and because the prompt half can only be
proven by rendering a prompt, which is the same lesson the adaptation critique
defect taught on this branch.
"""

import pytest

from src.agents.nodes import _background_context_for_prompt, agent_psychologist_node
from src.schemas.contract_registry import get_capabilities
from src.services import hebrew_prompts

from tests.test_contract_v5 import (
    BACKGROUND_CONTEXT,
    build_state,
    build_v5_round_data,
)
from src.contracts import AI_ANALYTICS_DIMENSION_IDS

ORGANIZATION_UUID = "8f1c2d34-5678-4abc-9def-0123456789ab"
CONTEXT_VERSIONS = ("4.0", "5.0", "6.0")


def _round_on(version, background_context=None):
    round_data = build_v5_round_data(background_context)
    round_data["contractVersion"] = version
    return round_data


def test_every_version_under_test_declares_the_capability():
    """The parametrisation is only meaningful while these three declare it."""
    for version in CONTEXT_VERSIONS:
        assert get_capabilities(version).supportsBackgroundContext, version


@pytest.mark.parametrize("version", CONTEXT_VERSIONS)
def test_the_organization_identity_is_not_a_school_context(version):
    """A round whose school answered nothing has no context, on any version."""
    round_data = _round_on(version)
    state = build_state(round_data)
    state["org_context"] = {"organizationId": ORGANIZATION_UUID}

    assert _background_context_for_prompt(round_data) is None


@pytest.mark.parametrize("version", CONTEXT_VERSIONS)
def test_the_declared_field_is_returned_whole(version):
    """What the contract declares is passed through untouched, not filtered.

    Filtering was the first shape tried and it is worse: the only measure
    available is the seven-key line builder, which `6.0` does not use, so it
    would erase fields that reach a `6.0` prompt today.
    """
    round_data = _round_on(version, BACKGROUND_CONTEXT)

    assert _background_context_for_prompt(round_data) == BACKGROUND_CONTEXT


def test_the_organization_id_never_reaches_a_v6_prompt():
    """The prompt half, proven where it can happen and nowhere else.

    All three `6.0` builders dump whatever they are handed, so this is the leg
    that fails against the old fallback. A flag assertion cannot show it, and a
    `5.0` prompt cannot either — it renders seven known fields and would have
    dropped the UUID on its own.
    """
    round_data = _round_on("6.0")
    state = build_state(round_data)
    state["org_context"] = {"organizationId": ORGANIZATION_UUID}
    selected = _background_context_for_prompt(round_data)

    aggregates = list(round_data["questionAggregates"].values())
    interventions = [
        {
            "id": "kb-bala-y-01",
            "dimensionId": "balance",
            "status": "yellow",
            "title": "חלונות מוגנים לעבודה ממוקדת",
            "summary": "מהלך מעשי לצמצום עומס בשבוע העבודה.",
            "actionable_steps": ["לקבוע חלון מוגן", "לבדוק את ההשפעה"],
        },
    ]
    prompts = (
        hebrew_prompts.v6_structured_summary_prompt(
            dim_hebrew="איזון",
            status="yellow",
            question_aggregates=aggregates,
            background_context=selected,
        ),
        hebrew_prompts.v6_metric_insights_prompt(
            dim_hebrew="איזון",
            status="yellow",
            question_aggregates=aggregates,
            background_context=selected,
        ),
        hebrew_prompts.v6_intervention_batch_prompt(
            interventions=interventions,
            dim_hebrew="איזון",
            status="yellow",
            question_aggregates=aggregates,
            background_context=selected,
        ),
    )

    for prompt in prompts:
        assert ORGANIZATION_UUID not in prompt
        assert "organizationId" not in prompt


@pytest.mark.asyncio
async def test_provenance_stops_claiming_a_context_the_round_never_had(
    answering_llm,
):
    """The flag half, end to end, on the state the runner really builds.

    Every other test in the suite builds `org_context` empty and the runner
    never does, which is why this defect lived beside a passing suite.
    """
    state = build_state(build_v5_round_data())
    state["org_context"] = {"organizationId": ORGANIZATION_UUID}

    result = await agent_psychologist_node(state)

    for dimension_id in AI_ANALYTICS_DIMENSION_IDS:
        provenance = result["generation_provenance"][dimension_id]
        assert provenance["backgroundContextIncluded"] is False, dimension_id
