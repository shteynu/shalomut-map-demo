# A 6.0 recommendation replay learns why it was refused

## Metadata

- Branch: `fix/v6-adaptation-repair-critique`
- Base branch: `main`
- Base commit: `79a6d39`
- Current HEAD: `edf7db5`
- Status: landed on `main` as 019963c, edf7db5; `origin/main` is `5188bfa`
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close item 1 of
[`ai-service-incidental-findings-2026-08-09.md`](../../ai-service-incidental-findings-2026-08-09.md):
the `usesStructuredDimensionSummary` branch of the adaptation path dropped the
`repair_critique` computed by the safety validator and sent only the transport's
own per-attempt critique.

## User-visible outcome

None directly. A recommendation replay on contract 6.0 now costs fewer wasted
heavy-tier requests, so a round is likelier to end on model-written copy instead
of catalog fallback within the same repair budget.

## Context

`agent_adaptation_node` computes a critique from `state["safety_violations"]`
and passes it into `adapt_interventions_result`. The pre-6.0 branch joins it
with the transport's per-attempt critique through `_joined_critique`; the 6.0
branch passed `repair_critique=retry_critique` and discarded the argument. A
replay therefore escalated to the heavy tier and re-sent a near-identical
request. The repair budget is three replays, so the waste was bounded and
repeated.

## Scope

- `ai-analytics-service/src/services/llm_provider.py` — the 6.0 prompt lambda.
- `ai-analytics-service/tests/test_repair_critique.py` — coverage for the 6.0
  branch, which the existing end-to-end tests did not reach because they build
  v5 round data.

## Non-goals

- Items 2–7 of the findings file. They remain deferred by owner decision.
- Any change to prompt wording, validator rules or contract semantics.

## Acceptance criteria

- The 6.0 batch prompt carries the validator's critique on the first attempt of
  a replay and both critiques on a retry inside that replay.
- A first pass with no refusal produces byte-identical prompt text to before.
- The full Python suite stays green.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

Contract semantics are untouched: the change is which text fills the existing
`repair_critique` slot of `v6_intervention_batch_prompt`. No versioned manifest,
`contracts/capabilities.json` entry or Core-side type changes.

## Decisions made

- Reuse `_joined_critique` rather than write a second joining rule, so both
  branches order the two critiques identically.
- Test at the provider boundary by capturing the built prompt. The existing
  end-to-end replay tests stub `adapt_interventions_result` whole, so they
  cannot see a defect inside it.

## Assumptions

- The 6.0 branch is meant to behave as the pre-6.0 branch does here. The
  docstring of `_joined_critique` states the rule for both.

## Completed

- The join in the 6.0 prompt lambda.
- Two tests: the replay case and the untouched-first-pass case.

## In progress

None.

## Remaining

None. The owner pushed the chain on 2026-08-09.

## Changed files

Committed in `019963c`:

- `ai-analytics-service/src/services/llm_provider.py`
- `ai-analytics-service/tests/test_repair_critique.py`

Committed together with this file:

- `docs/ai-service-incidental-findings-2026-08-09.md`
- this task file

Unstaged and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`. Nothing untracked.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service` — 465 passed.
- Guard check: with the fix reverted by hand,
  `test_a_replayed_6_0_adaptation_is_told_what_was_wrong` fails on the missing
  critique; restored afterwards.

### Failed

None.

### Blocked or not run

- TypeScript suite, lint, build: not run. The diff is Python-only and touches
  no contract artifact, so the matrix does not call for them.

### Environment

local

### Residual risk

The join is proven at the prompt-construction boundary, not against a live
provider. No real 6.0 replay was observed end to end.

## Failed approaches

Patching `_complete_with_retries` on the class does not hold: `test_contract_v6`
patches it on the `llm_provider_service` instance, and the instance attribute
that survives shadows a class-level patch. The tests patch the instance, as the
neighbouring v6 tests do.

## Known risks

None beyond the residual risk above.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

None. The chain landed on `main` on 2026-08-09 and this file is closed.
