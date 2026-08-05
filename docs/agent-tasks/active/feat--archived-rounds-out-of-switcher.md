# Archived rounds leave the switcher

## Metadata

- Branch: `feat/archived-rounds-out-of-switcher`
- Base branch: `main`
- Base commit: `c612c26`
- Current HEAD: `c612c26` plus this slice
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the open question in `docs/product-behaviour-backlog.md` §10: whether
archived rounds belong in the dashboard round switcher.

## User-visible outcome

The switcher offers the school's rounds without the archived ones. An archived
round a manager opened by URL still appears, as the selected entry, marked
`בארכיון`.

## Context

The status existed with no behaviour attached. `RoundService.isTransitionAllowed`
permits `draft`/`active`/`closed` → `archived` as a terminal transition, and
`orderRoundsForManager` merely listed archived rounds last. Nothing in the UI
archives a round: the only path is `PATCH /api/rounds/{roundId}` with
`status: "archived"`.

## Scope

- `toDashboardRoundOptions` filters archived rounds, keeping the selected one.
- Tests for the three cases that follow from it.
- ADR-018 and the backlog entry.

## Non-goals

- No archive action in the UI. Reaching the state stays an API-only path.
- No change to `orderRoundsForManager`, to round comparison, or to which round
  a manager lands on by default.

## Acceptance criteria

- An archived round is not offered as a choice.
- An archived round that is the selected round is shown, with its status in
  words.
- A school whose only other round is archived gets no switcher, because one
  round is not a choice.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-018 (new), ADR-014 (one active round at a time). No
contract, schema, migration or API change; the filter is presentation only.

## Decisions made

- Owner decision 2026-08-05: archiving means taking a round out of the everyday
  list and nothing else. It keeps its URL, its dashboard, its stored analysis
  and its place in the comparison history.
- The selected round is exempt from the filter. A switcher naming every round
  except the one on screen would misstate where the manager is.
- Comparison is untouched: `comparableRoundsBefore` still accepts archived
  rounds, because a round that measured a real semester stays evidence after it
  is filed away.

## Assumptions

- None load-bearing. The behaviour is decided rather than inferred.

## Completed

- `src/lib/dashboard/round-options.ts`: `belongsInSwitcher` filter with the
  reason in a comment.
- Three tests in `src/components/dashboard/__tests__/dashboard-round-switcher.test.tsx`.
- `PROJECT_CONTEXT.md` ADR-018 and `docs/product-behaviour-backlog.md` §10.

## In progress

- Nothing.

## Remaining

- The push is the owner's action.

## Changed files

- `src/lib/dashboard/round-options.ts`
- `src/components/dashboard/__tests__/dashboard-round-switcher.test.tsx`
- `PROJECT_CONTEXT.md`
- `docs/product-behaviour-backlog.md`
- `docs/agent-tasks/active/feat--archived-rounds-out-of-switcher.md` (new)

## Verification evidence

### Passed

- `npx tsx --test src/components/dashboard/__tests__/dashboard-round-switcher.test.tsx`
  — 6 tests, 0 failures, including the three new ones.
- `npm run verify:core` — exit code 0: 569 TypeScript tests, the literals,
  composition-root and mutation-config fitness checks, `typecheck`, ESLint and
  the production build.

### Failed

- None.

### Blocked or not run

- `verify:db` and `verify:ai`: no schema, migration, repository, route or Python
  change in the diff.
- **Browser smoke: not run.** No screen archives a round, so seeing this in a
  browser means creating an archived round through `PATCH /api/rounds/{roundId}`
  against the local database and signing in as the manager — to observe a pure
  function whose output is already asserted as server-rendered markup, on a page
  whose own code did not change. Recorded as a gap rather than closed cheaply.

### Environment

Local.

### Residual risk

- The filter is exercised through server-rendered markup rather than in a
  browser against a real archived round, because no screen can archive one.

## Failed approaches

- None.

## Known risks

- The behaviour is defined for a state the product cannot currently enter. It
  becomes observable only when the archive action is built or an archived round
  is created through the API.

## Approval gates

- None touched.

## Questions requiring an owner decision

- None. The one open question was answered by the decision above.

## Next concrete step

Hand the push over: `git push origin feat/archived-rounds-out-of-switcher:main`.
