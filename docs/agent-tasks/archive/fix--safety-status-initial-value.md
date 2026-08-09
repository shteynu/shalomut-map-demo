# `pending` is a state the state contract admits to

## Metadata

- Branch: `fix/safety-status-initial-value`
- Base branch: `feat/provider-failure-reason-reaches-core` (a chain on top of
  `fix/background-context-provenance`, `docs/outgoing-gate-docstring` and
  `fix/v6-adaptation-repair-critique`, based on `main` at `79a6d39`; none of
  them pushed)
- Base commit: `fe938df`
- Current HEAD: `aa5bead`
- Status: landed on `main` as aa5bead; `origin/main` is `5188bfa`
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close item 5 of
[`ai-service-incidental-findings-2026-08-09.md`](../../ai-service-incidental-findings-2026-08-09.md):
`safety_status` was declared with five `Literal` values while every round
started on a sixth, `pending`.

## User-visible outcome

None. Runtime behaviour is identical — `pending` was and remains the value a
round starts on.

## Context

The value is not the mistake; the declaration was incomplete. `pending` is a
real state: not judged yet, distinct from `pass`, `fail`, `privacy_locked`,
`pass_privacy` and `provider_unavailable`. Nothing caught the mismatch because
no type checker runs over this service, so the state contract is only as true
as the tests that read it.

## Scope

- `ai-analytics-service/src/agents/state.py` — the `SafetyStatus` alias with
  `pending` in it, and `build_initial_state`.
- `ai-analytics-service/src/services/analytics_runner.py` and
  `src/pipeline_cli.py` — both entrypoints now call the constructor.
- `ai-analytics-service/tests/test_agent_state_contract.py` — two tests.

## Non-goals

- Introducing mypy. Making the contract enforced by a type checker is a
  separate piece of work with its own fallout; this task makes it enforced by a
  test instead.
- Migrating the many test files that build their own state dictionaries. They
  are fixtures for specific scenarios, several carry extra keys, and the
  duplication there costs nothing in production.
- Items 6 and 7 of the findings file. They remain deferred by owner decision.

## Acceptance criteria

- Every `safety_status` value assigned anywhere in `src/` is one the alias
  declares, checked mechanically rather than by eye.
- Both entrypoints produce the same initial state, from one place.
- The Python suite stays green.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

Internal to the Python service. `safety_status` never crosses the callback
boundary; the payload carries `status` and `failureReason` instead. No contract
artifact is touched.

## Decisions made

- Add `pending` to the type rather than change the initial value. The code was
  right and the declaration was wrong.
- Extract `SafetyStatus` as a named alias so a test can read it with
  `typing.get_args`. A `Literal` inline in the `TypedDict` is not reachable
  that way without parsing hints.
- Have the test derive the assignments from `src/` by regex rather than list
  them. A hand-kept list is the same drift one level up.

## Assumptions

- `"safety_status": "<value>"` stays the way the key is written. If an
  assignment ever moves to a variable, the test's own guard (`assert assigned`)
  fires rather than passing silently.

## Completed

- The alias, the constructor, both entrypoints.
- `test_every_safety_status_the_service_writes_is_a_declared_one` and
  `test_a_round_starts_on_the_one_state_that_means_not_judged_yet`.
- The findings file: item 5 marked closed, status paragraph updated.

## In progress

None.

## Remaining

None. The owner pushed the chain on 2026-08-09.

## Changed files

Committed together with this file:

- `ai-analytics-service/src/agents/state.py`
- `ai-analytics-service/src/services/analytics_runner.py`
- `ai-analytics-service/src/pipeline_cli.py`
- `ai-analytics-service/tests/test_agent_state_contract.py`
- `docs/ai-service-incidental-findings-2026-08-09.md`

Unstaged and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`. Nothing untracked.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service` — 469 passed.
- Guard check: with `pending` removed from the alias by hand, both new tests
  fail (2 failed, 3 passed in `tests/test_agent_state_contract.py`); restored
  afterwards and the full suite re-run.

### Failed

None.

### Blocked or not run

- TypeScript suite, lint, build: not run. Nothing outside the Python service
  changed, and `safety_status` does not cross the boundary.

### Environment

local

### Residual risk

The new test proves the values agree, not that each one is reachable or
correct. A state that is declared and never written would still pass.

## Failed approaches

None.

## Known risks

None beyond the residual risk above.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

None. The chain landed on `main` on 2026-08-09 and this file is closed.
