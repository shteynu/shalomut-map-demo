# AI service — incidental findings, 2026-08-09 (all closed)

Seven defects and pieces of drift found while reading the pipeline for
[`scientific-evidence-layer-research-2026-08-09.md`](scientific-evidence-layer-research-2026-08-09.md).
None of them was introduced by that work and none was fixed by it.

**Status: deferred by owner decision on 2026-08-09, then unparked and fixed the
same day, one item at a time.** Every heading below records the branch that
closed it. The findings are kept as they were written, because they are the
reasoning each change was made from — which also means their line references
are pre-fix and no longer match the code.

---

## 1. A 6.0 recommendation replay is told nothing about why it was refused

**Fixed on 2026-08-09 in `019963c`** (branch `fix/v6-adaptation-repair-critique`).
The 6.0 branch now joins both critiques through `_joined_critique`, as the
pre-6.0 branch always did, and `tests/test_repair_critique.py` reads the prompt
the provider builds rather than stubbing the call whole. What follows is the
finding as written; the line references are pre-fix.

**Severity: real defect, costs money on every 6.0 repair.**

In the `usesStructuredDimensionSummary` branch of the adaptation path, the
prompt lambda passes `repair_critique=retry_critique`
([llm_provider.py:663-671](../ai-analytics-service/src/services/llm_provider.py#L663))
— the transport's own per-attempt critique only. It discards the
`repair_critique` that `agent_adaptation_node` computed from
`state["safety_violations"]` and passed in
([intervention_nodes.py:122-135](../ai-analytics-service/src/agents/intervention_nodes.py#L122)).
The pre-6.0 branch does it correctly, joining both with `_joined_critique`
([llm_provider.py:729-736](../ai-analytics-service/src/services/llm_provider.py#L729)).

Consequence: a recommendation replay triggered by the safety validator or by the
outgoing-refusal gate escalates to the heavy model tier and re-sends what is
close to the identical request, without being told what was wrong. The repair
budget is 3 replays, so the waste is bounded but repeated.

A fix is the join plus a test; `tests/test_repair_critique.py` is where the
existing coverage lives.

## 2. `stone_map_validation.py`'s docstring says the opposite of the truth

**Fixed on 2026-08-09** on branch `docs/outgoing-gate-docstring`. The docstring
now says the pipeline asks the gate, where it asks it, and what a refusal does
to the round. What follows is the finding as written.

The module docstring stated that nothing in the pipeline calls the outgoing gate
yet and that wiring it in "belongs to its own slice"
([stone_map_validation.py:1-18](../ai-analytics-service/src/schemas/stone_map_validation.py#L1)).
It had been live since `2acf62a` (2026-08-02): `graph.py:136` calls
`outgoing_refusal` inside
the loop, and the gate can trigger a targeted replay or fail the round with
`outgoing_<rule>` ([graph.py:129-166](../ai-analytics-service/src/agents/graph.py#L129)).

This is the most expensive item on the list for a reader — human or agent —
because anyone reasoning from the docstring concludes the payload is unvalidated
before the callback and puts a new rule in the wrong place.

## 3. `backgroundContextIncluded` is effectively always true on 4.0+

**Fixed on 2026-08-09** on branch `fix/background-context-provenance`. The
fallback to `org_context` is gone, so the flag now reports whether Core sent a
`RoundBackgroundContext`, which is what the 4.0 manifest says it means. The
function no longer takes the state at all, and `test_contract_v5.py` holds the
runner's own starting state to a `False`. What follows is the finding as
written.

`_background_context_for_prompt` fell back to `state["org_context"]`
([node_support.py:88-97](../ai-analytics-service/src/agents/node_support.py#L88)),
and the runner always seeds `org_context` with `{"organizationId": <uuid>}`
because Core always sends it
([analytics_runner.py:67-72](../ai-analytics-service/src/services/analytics_runner.py#L67)).
The provenance flag is computed as `bool(...)` of that
([psychologist_node.py:241-243](../ai-analytics-service/src/agents/psychologist_node.py#L241)),
so it is `True` on every 4.0+ round, including rounds with no background context
at all.

No respondent data leaks — the fallback carries only an organization id. But the
flag means "we had something" rather than "the school gave us context", and any
later work that reads it as the latter reads noise.

## 4. `provider_failure_reason` is written and never consumed

**Fixed on 2026-08-09** on branch `feat/provider-failure-reason-reaches-core`,
by the owner's decision to carry the reason out rather than delete the key. The
failure payload's `failureReason` is now `provider_unavailable` followed by the
reason when the run learned one, so Core stores it as the run's `failureCode`
and labels its operational metric with it. What follows is the finding as
written.

Declared at [state.py:97](../ai-analytics-service/src/agents/state.py#L97),
written at
[psychologist_node.py:184](../ai-analytics-service/src/agents/psychologist_node.py#L184)
and `:340`, asserted by one test
(`tests/test_semantic_quality.py:315`), read by no production code. The reason
the provider was unavailable is therefore known inside the run and lost before
anyone can act on it — Core receives only `failureReason: provider_unavailable`.

Worth noting as a pattern, not only as an item: a state key can be added, filled
and go dead without a single test failing.

## 5. `safety_status` is initialised to a value its own type does not allow

**Fixed on 2026-08-09** on branch `fix/safety-status-initial-value`. `pending`
is a declared value now, the eight-key construction lives in one
`build_initial_state`, and `test_agent_state_contract.py` reads every
`safety_status` assignment out of `src/` and holds it to the declared alias —
which is the closest thing to a type checker this service has. What follows is
the finding as written.

`AnalyticsState` declared five `Literal` values for `safety_status`
([state.py:86-92](../ai-analytics-service/src/agents/state.py#L86)); the initial
state sets `"pending"`
([analytics_runner.py:80](../ai-analytics-service/src/services/analytics_runner.py#L80)),
and the same eight-key construction is duplicated in `pipeline_cli.py` and in
tests. The state contract is advisory rather than enforced — no type checker runs
over this service — so the mismatch is invisible today.

## 6. A stray root file breaks `pytest` when it is pointed at the service

**Fixed on 2026-08-09** on branch `chore/experiment-scripts-out-of-pytest-path`.
Both prompt experiments moved to `ai-analytics-service/experiments/` under
names pytest does not collect, with a README saying what they are and that they
spend provider quota. What follows is the finding as written.

`ai-analytics-service/test_prompt.py` errored on import, so
`python -m pytest ai-analytics-service --collect-only` reports "463 tests
collected, 1 error". The configured run is unaffected because
`pyproject.toml` sets `testpaths = ["tests"]`
([pyproject.toml:29-31](../ai-analytics-service/pyproject.toml#L29)), and
`npm run verify:ai` uses it. Only someone invoking pytest by path sees red for a
reason unrelated to their change.

## 7. `docs/source-of-truth.md` documents a field that does not exist

**Fixed on 2026-08-09** on branch `docs/source-of-truth-staff-count-path`. The
row names `Organization.totalStaffCount`, says where it is edited and says that
it never crosses the MCP boundary — which is the part a later plan would
otherwise get wrong. What follows is the finding as written.

Line 88 listed `backgroundContext.totalStaffCount`. `RoundBackgroundContext` has
seven fields and that is not one of them
([backend.ts:16-24](../src/lib/types/backend.ts#L16)); `totalStaffCount` lives on
`Organization` ([backend.ts:12](../src/lib/types/backend.ts#L12)) and never
crosses the MCP boundary. The row's "Source: Organization record" column is
right; the path is wrong.

This one matters beyond documentation hygiene: it is exactly the field a later
plan would budget as already-available AI input.
