# The prompt experiments stop pretending to be tests

## Metadata

- Branch: `chore/experiment-scripts-out-of-pytest-path`
- Base branch: `fix/safety-status-initial-value` (a chain on top of
  `feat/provider-failure-reason-reaches-core`,
  `fix/background-context-provenance`, `docs/outgoing-gate-docstring` and
  `fix/v6-adaptation-repair-critique`, based on `main` at `79a6d39`; none of
  them pushed)
- Base commit: `aa5bead`
- Current HEAD: `edf64ed`
- Status: landed on `main` as edf64ed; `origin/main` is `5188bfa`
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close item 6 of
[`ai-service-incidental-findings-2026-08-09.md`](../../ai-service-incidental-findings-2026-08-09.md):
`python -m pytest ai-analytics-service` ended in a collection error caused by a
debug script, not by the caller's change.

## User-visible outcome

None. This is developer ergonomics.

## Context

`test_prompt.py` and `test_raw_answers.py` are prompt experiments from
2026-07-28, deliberately kept in `6c1e760`. Their names put them in pytest's
collection path, and `test_prompt.py` calls a live provider at module level, so
collecting it raised `ProviderUnavailableError`. The configured run never saw
this — `pyproject.toml` sets `testpaths = ["tests"]` and `npm run verify:ai`
uses it — but anyone pointing pytest at the directory got a red run for an
unrelated reason.

## Scope

- `ai-analytics-service/test_prompt.py` →
  `ai-analytics-service/experiments/prompt_depth_overall_summary.py`
- `ai-analytics-service/test_raw_answers.py` →
  `ai-analytics-service/experiments/prompt_depth_raw_answers.py`
- `ai-analytics-service/experiments/README.md` — new.
- `docs/local-environment.md` — it named both files by their old paths.

## Non-goals

- Deleting the scripts. A commit exists whose whole purpose was keeping them.
- Changing what they do. The contents are unchanged, including the
  module-level call that made collection fail; outside the collection path it
  is exactly what a script should do.
- Rewriting `docs/ai-insights-depth-plan-2026-07-27.md`, which mentions the old
  names. It is a dated plan and stays historical evidence.
- Item 7 of the findings file. It remains deferred by owner decision.

## Acceptance criteria

- `python -m pytest ai-analytics-service --collect-only` collects cleanly.
- The configured suite is unchanged in count and result.
- The scripts remain runnable, and how to run them is written down.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-verification/SKILL.md`, and the
documentation lifecycle rules in `AGENTS.md` for the dated plan left alone.

## Relevant architecture and contracts

None touched.

## Decisions made

- Move rather than delete or ignore. `collect_ignore` would have hidden the
  symptom while leaving two non-tests named like tests.
- Rename to say what they are. `prompt_depth_*` matches the work they came
  from.
- Keep `load_dotenv(".env")` as is and document that they run from the service
  root, rather than make the path absolute — that would be a change to a
  script this task is not otherwise touching.

## Assumptions

None.

## Completed

- Both moves, the README, the `docs/local-environment.md` correction.
- The findings file: item 6 marked closed, status paragraph updated.

## In progress

None.

## Remaining

None. The owner pushed the chain on 2026-08-09.

## Changed files

Committed together with this file:

- `ai-analytics-service/experiments/prompt_depth_overall_summary.py` (renamed)
- `ai-analytics-service/experiments/prompt_depth_raw_answers.py` (renamed)
- `ai-analytics-service/experiments/README.md`
- `docs/local-environment.md`
- `docs/ai-service-incidental-findings-2026-08-09.md`

Unstaged and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`. Nothing untracked.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest ../ai-analytics-service --collect-only -q` — 469
  collected, no error. Before the move the same command ended
  `469 tests collected, 1 error` and `Interrupted: 1 error during collection`.
- `.venv/bin/python -m pytest` from `ai-analytics-service` — 469 passed.

### Failed

None.

### Blocked or not run

- Running either experiment: not run, deliberately. Both call a live provider
  and spend quota, and neither is evidence about this change.
- TypeScript suite, lint, build: not run. Nothing outside the Python service
  and two documents changed.

### Environment

local

### Residual risk

The scripts are unexercised by any suite, as before. If the provider API they
call changes, nothing will report it until someone runs one.

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
