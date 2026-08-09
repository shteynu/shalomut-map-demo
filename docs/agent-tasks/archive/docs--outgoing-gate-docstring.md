# The outgoing gate's docstring describes the gate that is running

## Metadata

- Branch: `docs/outgoing-gate-docstring`
- Base branch: `fix/v6-adaptation-repair-critique` (which is based on `main` at
  `79a6d39` and is itself unpushed)
- Base commit: `edf7db5`
- Current HEAD: `e385b09`
- Status: landed on `main` as e385b09; `origin/main` is `5188bfa`
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close item 2 of
[`ai-service-incidental-findings-2026-08-09.md`](../../ai-service-incidental-findings-2026-08-09.md):
the module docstring of `stone_map_validation.py` said nothing in the pipeline
calls the outgoing gate and that wiring it in belongs to its own slice, while
`graph.py` has called it since `2acf62a` (2026-08-02).

## User-visible outcome

None. This is a correction to what the code says about itself.

## Context

Anyone reasoning from the old docstring concludes the assembled payload is
unvalidated before the callback, and puts a new rule where it will not run. The
gate is in fact asked inside the safety loop, immediately after
`format_stone_map_output_node`: a refusal that names a target replays that part
while the repair budget lasts, and otherwise the round ends as
`outgoing_<rule>`.

## Scope

- `ai-analytics-service/src/schemas/stone_map_validation.py` — module docstring.

## Non-goals

- Any behaviour change. The rules, the gate and the loop are untouched.
- Items 3–7 of the findings file. They remain deferred by owner decision.

## Acceptance criteria

- The docstring states that the pipeline calls the gate, where, and what a
  refusal costs the round.
- It keeps the second thing the module does — judging the shared callback
  corpus on this side — because that is still true.
- The Python suite stays green.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

None touched. No contract, manifest or capability entry changes.

## Decisions made

- Correct the docstring in place rather than delete the stale paragraph: the
  reason the module exists (a judge on this side of the boundary) is still
  worth saying, only its "nothing calls this yet" clause was false.
- Record in the findings file when the gate went live (`2acf62a`), replacing the
  finding's vaguer "for some time".

## Assumptions

None.

## Completed

- The docstring.
- The findings file: item 2 marked closed, status paragraph updated.

## In progress

None.

## Remaining

None. The owner pushed the chain on 2026-08-09.

## Changed files

Committed together with this file:

- `ai-analytics-service/src/schemas/stone_map_validation.py`
- `docs/ai-service-incidental-findings-2026-08-09.md`

Unstaged and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`. Nothing untracked.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service` — 465 passed.
- The docstring's claims read against the code: `graph.py:135-166` for the call
  site, the replay and the `outgoing_<rule>` failure;
  `tests/test_callback_corpus.py` for the corpus use.

### Failed

None.

### Blocked or not run

- TypeScript suite, lint, build: not run. Nothing outside the Python service
  changed, and no executable Python changed at all.

### Environment

local

### Residual risk

None beyond the usual: a docstring can go stale again if the gate moves.

## Failed approaches

None.

## Known risks

None.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

None. The chain landed on `main` on 2026-08-09 and this file is closed.
