# Archived rounds leave the switcher

## Metadata

- Branch: `feat/archived-rounds-out-of-switcher`
- Base branch: `main`
- Base commit: `c612c26`
- Current HEAD: `5a8a3c9` plus the archive action
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the open question in `docs/product-behaviour-backlog.md` §10: whether
archived rounds belong in the dashboard round switcher.

## User-visible outcome

A manager can file a closed round away with `העברה לארכיון`. The switcher then
offers the school's rounds without it, and it stays reachable behind
`הצגת הארכיון (N)`. An archived round the manager is looking at appears in the
everyday list, marked `בארכיון`.

## Context

The status existed with no behaviour attached. `RoundService.isTransitionAllowed`
permits `draft`/`active`/`closed` → `archived` as a terminal transition, and
`orderRoundsForManager` merely listed archived rounds last. Nothing in the UI
archives a round: the only path is `PATCH /api/rounds/{roundId}` with
`status: "archived"`.

## Scope

- `toDashboardRoundOptions` returns two groups: everyday rounds and the archive.
- The switcher renders the archive behind a `details` disclosure.
- `RoundControls` gains the archive action, offered only once a round is closed.
- Tests for both, ADR-018 and the backlog entry.

## Non-goals

- The archive is not read-only. Refreshing the analysis and resetting the data
  still work on an archived round; only closing is disabled, and only because
  the route would answer `409`.
- No change to `orderRoundsForManager`, to round comparison, or to which round
  a manager lands on by default.

## Acceptance criteria

- A closed round can be archived from its own screen; a running one cannot.
- An archived round is not offered among the everyday choices but is reachable
  through the disclosure, which starts closed.
- An archived round that is the selected round is shown in the everyday list,
  with its status in words.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-018 (new), ADR-014 (one active round at a time). No
contract, schema, migration or route change: the action calls the existing
`PATCH /api/rounds/{roundId}`, whose `archived` target and transition rules
already existed, and everything else is presentation.

## Decisions made

- Owner decision 2026-08-05: archiving means taking a round out of the everyday
  list and nothing else. It keeps its URL, its dashboard, its stored analysis
  and its place in the comparison history.
- The selected round is exempt from the filter. A switcher naming every round
  except the one on screen would misstate where the manager is.
- Owner correction 2026-08-05: hiding without a way back was not the intent.
  The archive must be reachable from the switcher, and archiving must be an act
  the manager performs — otherwise a round only ever becomes `closed` and the
  filter never fires.
- Archiving is offered only after a round is closed. Archiving a live round
  would take its share link out of the list while staff were still answering.
- The route's refusal text is English prose, so the screen shows its own Hebrew
  sentence rather than passing the API's wording through.
- Comparison is untouched: `comparableRoundsBefore` still accepts archived
  rounds, because a round that measured a real semester stays evidence after it
  is filed away.

## Assumptions

- None load-bearing. The behaviour is decided rather than inferred.

## Completed

- `src/lib/dashboard/round-options.ts` returns `{ current, archived }`.
- The switcher renders the archive behind `details`, with its own quiet style in
  `globals.css`; `dashboard-map-page.tsx` carries the new prop type.
- `RoundControls`: the archive action, its confirmation, its note, and closing
  disabled on an archived round.
- Eight switcher tests and five new tests in
  `src/components/round/__tests__/round-archive-action.test.tsx`.
- `PROJECT_CONTEXT.md` ADR-018 and `docs/product-behaviour-backlog.md` §10.

## In progress

- Nothing.

## Remaining

- The push is the owner's action.

## Changed files

- `src/lib/dashboard/round-options.ts`
- `src/components/dashboard/dashboard-round-switcher.tsx`
- `src/components/dashboard/dashboard-map-page.tsx`
- `src/components/round/round-controls.tsx`
- `src/app/globals.css`
- `src/components/dashboard/__tests__/dashboard-round-switcher.test.tsx`
- `src/components/round/__tests__/round-archive-action.test.tsx` (new)
- `PROJECT_CONTEXT.md`
- `docs/product-behaviour-backlog.md`
- `docs/agent-tasks/active/feat--archived-rounds-out-of-switcher.md` (new)

## Verification evidence

### Passed

- `npx tsx --test` on both component test files — 8 and 5 tests, 0 failures.
- `npm run verify:core` — exit code 0 twice, at 569 tests for the filter alone
  and at 576 with the archive action: the literals, composition-root and
  mutation-config fitness checks, `typecheck`, ESLint and the production build
  each time.

### Failed

- None.

### Blocked or not run

- `verify:db` and `verify:ai`: no schema, migration, repository, route or Python
  change in the diff.
- **Browser smoke: not run.** The flow is now reachable end to end — close a
  round, archive it, open the disclosure — but every manager screen is behind
  `/login`, and the manager password is a credential the agent does not read or
  type. This is the same boundary as the deployed functional check: it is done
  with the owner signed in. Worth doing for this slice, because the archive
  disclosure and the confirmation dialog are the two parts markup assertions
  cover least.

### Environment

Local.

### Residual risk

- Everything is exercised through server-rendered markup. What no test here
  covers: that the `PATCH` actually lands from the button, that `confirm`
  reads well in Hebrew RTL, and that the disclosure looks right inside the map
  sidebar.

## Failed approaches

- None.

## Known risks

- An archived round can still be reset or re-analysed. The archive is a place
  the round is filed in, not a lock, and the backlog says so.

## Approval gates

- None touched.

## Questions requiring an owner decision

- None. The one open question was answered by the decision above.

## Next concrete step

Hand the push over: `git push origin feat/archived-rounds-out-of-switcher:main`.
