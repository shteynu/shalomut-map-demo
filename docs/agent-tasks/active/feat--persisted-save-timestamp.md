# The save time survives a reload

## Metadata

- Branch: `feat/persisted-save-timestamp`
- Base branch: `main`
- Base commit: `e7a2ea6`
- Current HEAD: `e7a2ea6`
- Status: in progress
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the remaining half of `docs/product-behaviour-backlog.md` §1: the setup
screen and the survey builder show when the round last reached the database,
and that time survives a page reload.

## User-visible outcome

Reopening the setup screen or the builder shows "נשמר בשעה HH:MM" for the last
save the database actually recorded, instead of showing nothing until the
manager saves again in that session.

## Context

The 2026-08-04 slice added a shared `SaveStatus` line fed by a `savedAt` the
save endpoints report. Both endpoints stamp `new Date()` in the route handler
and nothing persists it, so the line exists only for the current session.

## Scope

- `survey_rounds.updated_at`, its migration and the Prisma model.
- `SurveyRound.updatedAt` through the repository interface and both
  implementations.
- The two save endpoints reporting the persisted time.
- The setup page and the survey page seeding the components with it.

## Non-goals

- Draft/version history or recovery beyond the latest persisted definition
  (the other, undecided half of §1).
- A per-organization save time; the round is what these two screens edit.

## Acceptance criteria

- A save writes `updated_at`, and the endpoints report that value rather than a
  handler-local clock reading.
- A reload of either screen shows the persisted time.
- A round that was never saved since the column existed shows no time rather
  than an invented one.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — persistence and UI boundaries.
- `.agents/skills/shalomut-verification/SKILL.md` — evidence before claiming.

## Relevant architecture and contracts

- Repositories are assembled in `src/lib/composition-root.ts`; nothing below
  that boundary resolves them.
- The AI contract is untouched: this is a Core persistence and UI change.

## Decisions made

_None recorded yet._

## Assumptions

_None recorded yet._

## Completed

_Nothing yet._

## In progress

- Persisting the timestamp.

## Remaining

- Persistence, UI, verification, documentation.

## Changed files

_None yet._

## Verification evidence

### Passed

_None yet._

### Failed

_None._

### Blocked or not run

- Everything; no check has run on this branch.

### Environment

Local worktree at `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

_None recorded yet._

## Failed approaches

_None._

## Known risks

_None recorded yet._

## Approval gates

None. This touches no secret, credential, authentication configuration or
deployment alias.

## Questions requiring an owner decision

None.

## Next concrete step

Add `survey_rounds.updated_at` with its migration and carry it through the
round repositories.
