# The school's goals in one place

## Metadata

- Branch: `feat/goals-across-rounds`
- Base branch: `main`
- Base commit: `3c551a5`
- Current HEAD: `3c551a5` plus this slice
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the open half of `docs/product-behaviour-backlog.md` §5 — reading a
school's goals across rounds.

## User-visible outcome

A new screen, `מעקב יעדים` at `/goals`, listed in the main navigation after the
map. It lists every goal of every round the school has run: open ones under
`בעבודה (N)`, finished ones under `הושלמו (N)`. Each row carries the goal's text,
its dimension as a link back to that round's recommendations, the round's title,
and a `בארכיון` marker when the round was filed away. The three-state control is
the same one the dimension screen uses, and it works here too.

## Context

A goal has always belonged to the round it was chosen in, and that round's
dimension screen was the only place to read it. That became a real gap on
2026-08-05, when the archive turned read-only: an archived round's goals are
deliberately still editable, and the round they belong to now sits behind a
disclosure in the switcher.

## Scope

- `IRoundGoalRepository.findByRoundIds` and both adapters.
- `buildSchoolGoalsView`, the screen's whole model.
- `/goals` page, the client board, navigation entry, styles.
- Tests at three levels, plus the backlog and `PROGRESS.md`.

## Non-goals

- A new API route. The page renders server-side and writes through the existing
  per-round `PATCH`.
- Owners, due dates or a plan of steps. Still a separate decision, deliberately
  not taken.
- Showing a goal beside the delta of its dimension. Different question.

## Acceptance criteria

- Every goal of every round of the manager's school appears, and no other.
- Open and finished goals are separated, and a goal moved to `הושלם` moves
  groups without a reload.
- A goal from an archived round is shown, marked, and still editable.
- A school with no goals gets an empty state that says where goals come from.

## Relevant repository instructions

- `AGENTS.md`: the composition root is the only place that constructs a
  repository; navigation metadata is centralized in `src/lib/navigation.ts`.

## Relevant architecture and contracts

- No contract is touched: goals never leave Core.
- Privacy: a goal holds recommendation copy that already cleared the privacy
  gate when it was chosen, plus a round title. Nothing about a respondent
  reaches this screen, and it shows no scores or counts.

## Decisions made

- **The read takes round ids, not an organization id.** `IRoundGoalRepository`
  says a goal is never reachable without naming its round, because
  authorization happens per round. The caller passes the rounds the manager
  context already resolved inside the school, which keeps that property.
- **One write path.** The board `PATCH`es the existing per-round endpoint rather
  than gaining a route of its own, so the two screens cannot disagree about what
  a status change means.
- **The page is not round-scoped** and takes no `round` parameter: a goal
  outlives the measurement it came from.
- **Rows are re-grouped after a write**, not patched in place, so a goal that
  just became `הושלם` stops being counted as work in progress.
- **Goals last in the navigation**, after the map, because that is the order of
  the work: read the picture, then decide what to do about it.

## Assumptions

- Goals per school stay small enough to list without paging. The instrument
  produces five recommendations per dimension per round; a school tracking more
  than a screenful has a different problem than pagination.

## Completed

All of the scope above.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

New: `src/app/goals/page.tsx`, `src/components/goals/school-goals-board.tsx`,
`src/lib/goals/school-goals.ts`, and three test files
(`src/lib/goals/__tests__/school-goals.test.ts`,
`src/components/goals/__tests__/school-goals-board.test.tsx`, plus additions to
`src/lib/services/__tests__/round-goal.service.test.ts` and
`src/lib/repositories/__dbtests__/postgres-round-goals.test.ts`).

Modified: `src/lib/repositories/interfaces.ts` and both goal adapters;
`src/lib/server/manager-context.ts`; `src/lib/navigation.ts` and its test;
`src/app/page.tsx` and `src/components/layout/app-header.tsx` (the icon maps are
exhaustive over the nav ids, so a new entry has to be given an icon);
`src/app/globals.css`; `docs/product-behaviour-backlog.md`; `PROGRESS.md`.

Untouched and pre-existing: `.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, 606 tests, 606 pass (up from 596). Includes
  lint, types, the four fitness checks and the production build.
- `npm run verify:db` — 26 tests, 26 pass, against the disposable local
  PostgreSQL. The new case proves `findByRoundIds` honours the list rather than
  widening it, and that an empty list reads as no goals rather than all of them.

### Failed

None.

### Blocked or not run

- `verify:ai` — no Python change.
- No browser evidence. The screen is behind `/login` and the manager password is
  the owner's to type. Its states are covered by rendering tests instead: empty,
  a goal with its provenance, an archived round's marker, and the two counted
  groups.

### Environment

Local. No schema change, so nothing is pending on the deployed database.

### Residual risk

- The board holds the server's rows in client state. A goal changed on the
  dimension screen in another tab is not reflected until this screen is
  reloaded. The write itself is safe — it goes to the server — and the same is
  already true of the dimension screen.

## Failed approaches

- The first version hand-built the recommendations URL. `navigation.ts` already
  exports `dashboardDimensionRecommendationsRoute`; using it is what keeps every
  dashboard link carrying its round.

## Known risks

None beyond the residual risk above.

## Approval gates

None.

## Questions requiring an owner decision

- Whether the screen should also show the dimension's current score beside a
  goal. Backlog §5 still lists that as unbuilt and it is a different question
  from where the goals are listed.

## Next concrete step

The owner pushes: `git push origin feat/goals-across-rounds:main`.
