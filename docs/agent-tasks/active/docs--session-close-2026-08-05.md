# Session close, 2026-08-05

## Metadata

- Branch: `docs/session-close-2026-08-05`
- Base branch: `main`
- Base commit: `4b0a4bd`
- Current HEAD: `4b0a4bd` plus this slice
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the session: archive the finished task file, refresh the operational
snapshot to the current `main`, and record what remains so the next agent starts
from what is true rather than from what was true this morning.

## User-visible outcome

None.

## Context

Five branches reached `main` on 2026-08-05, each pushed by the owner:
`feat/survey-definition-history` (backlog §1, the questionnaire version
history), `feat/archived-rounds-read-only` (§10), `feat/goals-across-rounds`
(§5), `docs/close-causal-refusal-decision` and `docs/roadmap-reconciliation`.
The product-behaviour backlog now has no unblocked implementation item.

## Scope

- Archive `docs--roadmap-reconciliation.md`.
- Handoff: snapshot to `4b0a4bd`, a new section naming what is open and what
  each item waits on, and one stale entry corrected — a branch chain it still
  described as waiting to be pushed had already landed.
- `PROGRESS.md`: pointer to that section.

## Non-goals

- Any code change.
- Deciding anything that is recorded as waiting on the owner.

## Acceptance criteria

- No living document names a commit or a waiting branch that is not current.
- The next agent can read one place and know what is left and who it waits on.

## Relevant repository instructions

- `AGENTS.md`, mandatory progress handoff: inspect the diff, run the checks the
  diff actually warrants, update the branch task file first, leave exactly one
  next concrete step, and update a global document only where its owned state
  changed.
- Visibility follows Git: everything below is committed on this branch and
  therefore visible to another worktree, but not to another checkout until the
  owner pushes.

## Decisions made

- **"What is open" lives in the handoff, not in `PROGRESS.md`.** It is a list of
  gates and requests rather than product milestones, which is what the handoff
  owns. `PROGRESS.md` points at it in one line.
- **The four items are recorded as waiting, not as backlog.** Two are owner
  decisions, two wait on being requested, and one — the signed-in walk — waits
  on hands the agent does not have.

## Assumptions

- The owner pushes this branch; until then it exists in this worktree only.

## Completed

All of the scope above.

## In progress

Nothing.

## Remaining

Nothing on this branch.

## Changed files

- `docs/agent-tasks/active/docs--roadmap-reconciliation.md` moved to
  `docs/agent-tasks/archive/`.
- `docs/shalomut-tracker-handoff.md`, `PROGRESS.md`.
- This file, new.

Exact Git state at handoff: four commits ahead of `origin/main` will exist once
this file is committed — one commit on this branch. Nothing is staged or
unstaged beyond it. Untracked/modified and deliberately untouched, as they have
been all session: `.idea/shalomut-map-demo.iml` and `next-env.d.ts`, both
pre-existing IDE noise belonging to the owner.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, 606 tests, 606 pass, run at the content of
  `4b0a4bd` before this documentation slice.

### Failed

None.

### Blocked or not run

- `verify:core` was **not** re-run for this slice: it changes only Markdown that
  no check reads.
- `verify:db` and `verify:ai` — no schema, repository or Python change all
  session after the morning.
- Deployment of `4b0a4bd` was **not** read. The last reading is of `763e38f`,
  and both commits after it are documentation.

### Environment

Local.

### Residual risk

None.

## Failed approaches

None.

## Known risks

- The three newest manager screens have never been opened in a browser by
  anyone. They are covered by rendering and route tests, which is a weaker claim
  than a signed-in walk, and the handoff says so in two places.

## Approval gates

- Still open and unchanged: rotating the four design-stage credentials before
  the first real respondents.

## Questions requiring an owner decision

Recorded in `docs/shalomut-tracker-handoff.md` under "What is open, and what it
waits on": whether a goal gains an owner, a due date or a plan of steps; and
whether a goal should be read beside the delta of its dimension.

## Next concrete step

The owner pushes: `git push origin docs/session-close-2026-08-05:main`. The next
session should open the UptimeRobot monitor first — a day of uptime is the
cheapest open question in the record — and then take one of the two owner
decisions above, or plan the signed-in walk of the three newest screens.
