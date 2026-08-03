# Round history selection on the dashboard (backlog §10, reading side)

## Metadata

- Branch: `feat/round-history-selection`
- Base branch: `main`
- Base commit: `8e1906e`
- Current HEAD: `e17f905`
- Status: complete and verified in a browser; not pushed
- Last updated: 2026-08-03
- Last agent/tool: Claude Code

## Objective

Let the dashboard show any round the school owns, not only the active one. This
is the reading half of backlog §10; creating a second round is separate work.

## Context

The previous session named this slice `feat/round-history-selection` and left
the note in `docs/agent-tasks/archive/feat--respondent-draft-and-consent.md`.
Its plan document was never committed, so §5.4/§13 references in that handoff
cannot be read from the repository. What survives is the branch name, the
sequencing argument and the two open questions.

## Decisions made

- Owner decision 2026-08-03, variant A: the home screen keeps showing the
  active round regardless of what the dashboard is looking at.
- An unknown or foreign round id produces a `round-not-found` screen. Falling
  back to the active round would show one round's numbers under another round's
  link.
- The round travels as a `?round=` search parameter rather than a path segment,
  so existing dashboard routes and their static params are untouched.
- The switcher is links, not a select: switching rounds is navigation, it works
  without JavaScript, and every round keeps a returnable URL.
- The switcher renders on the map screen only, including its locked state.
  Detail screens inherit the round through their links and already name it in
  the heading.
- Archived rounds stay listed, last. Hiding them is a product call left in the
  backlog rather than made silently here.

## Completed

- Commit `11daa6f`: mechanical rename of `currentRound` to `selectedRound` and
  `selectCurrentRound` to `selectActiveRound` across 11 files and 63
  references.
- `ManagerContextService.load` takes a requested round id, resolves it inside
  the manager's organization, and returns the ordered `rounds` list plus a
  `round-not-found` state.
- `readRoundParam` plus round-aware route builders in `navigation.ts`; every
  dashboard link carries the selected round.
- `DashboardRoundSwitcher` and `toDashboardRoundOptions`, with CSS in the
  existing warm token system and a reduced-motion branch.
- `round-not-found` screen in `ManagerOnboarding`.
- Tests: 4 new context cases, 4 new navigation cases, 3 switcher cases.
- Docs: backlog §10 updated to what actually landed, `PROGRESS.md` updated.

## Remaining

Creating a second round from the UI is PR 3.

## Verification evidence

### Passed

- `npm run verify:core`: fitness checks, `tsc --noEmit`, 448 TypeScript tests
  (11 new), ESLint, `next build`.
- Browser, local dev server, owner-authenticated session, against a school with
  two rounds (`סבב סתיו 2026` active with no responses, `סבב בדיקה מקומי` closed
  with twelve):
  - `/dashboard` opens the active round, locked at 0 of 10, with the switcher
    present on the locked screen.
  - Selecting the closed round navigates to
    `/dashboard/?round=round_local_...` and renders its map, overall score 76
    and per-dimension statuses.
  - A stone opens `/dashboard/balance/?round=round_local_...`; from its metrics
    screen both dashboard links keep the round
    (`.../recommendations/?round=...` and `/dashboard/?round=...`), while
    `חזרה למסך הראשי` stays plain `/`.
  - `?round=round-that-does-not-exist` renders the not-found screen and no
    data.
  - Home shows `סבב סתיו 2026` while the dashboard was on the closed round,
    which is variant A.
  - The switcher exposes `aria-label="בחירת סבב אבחון"`, `aria-current="page"`
    on the selected round and a status word per entry; in the 352px sidebar
    column the entries stack rather than overflow.

### Blocked or not run

- A true mobile viewport was not verified: the browser resize call did not
  change `window.innerWidth`, which stayed 1728. The narrow-column stacking
  above is the closest evidence taken.
- `npm run verify:db` and `npm run verify:ai` were not re-run for this diff: it
  touches no schema, no repository and no contract. They passed on this base
  commit earlier today.

### Environment

Local worktree, local PostgreSQL, local dev server on port 3000. The second
round was added to the local development database for this check and is
disposable test data.

### Residual risk

Low. The narrow-viewport rendering of the switcher rests on `flex-wrap` and the
sidebar observation rather than on a mobile-width run.

## Questions requiring an owner decision

None open. Variant A answered the one that blocked this slice.

## Next concrete step

The owner runs `git push origin feat/round-history-selection:main`; pushing is
blocked for the agent in this environment. Archive this file once it lands. The
next slice is PR 3, creating a round for a school that already has one.
