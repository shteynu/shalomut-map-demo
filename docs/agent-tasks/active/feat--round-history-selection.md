# Round history selection on the dashboard (backlog §10, reading side)

## Metadata

- Branch: `feat/round-history-selection`
- Base branch: `main`
- Base commit: `8e1906e`
- Current HEAD: `11daa6f` (rename commit); behaviour changes uncommitted at the
  time of writing
- Status: implementation complete, browser verification blocked on manager login
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

- Browser verification of the switcher (see below).
- Creating a second round from the UI is PR 3.

## Verification evidence

### Passed

- `npm run verify:core`: fitness checks, `tsc --noEmit`, 448 TypeScript tests
  (11 new), ESLint, `next build`.

### Blocked or not run

- Browser verification is blocked: `/dashboard` requires a manager login and
  the agent must not type credentials. The local server runs, the login screen
  renders, and a second round (`סבב סתיו 2026`, active, no responses) was added
  to the local database so the switcher has something to switch between. The
  owner logs in, then the switcher can be checked on the map screen, the locked
  branch, a detail screen and a bad `?round=` value.
- `npm run verify:db` and `npm run verify:ai` were not re-run for this diff: it
  touches no schema, no repository and no contract. They passed on this base
  commit earlier today.

### Environment

Local worktree, local PostgreSQL, local dev server on port 3000.

### Residual risk

The switcher is unverified in a browser. The rendering is covered by
server-rendered markup assertions, so the risk is layout rather than logic.

## Questions requiring an owner decision

None open. Variant A answered the one that blocked this slice.

## Next concrete step

Log in locally, open `/dashboard`, and confirm the switcher lists both rounds,
that selecting the closed round keeps `?round=` through a stone and back, and
that a made-up `?round=` value shows the not-found screen. Then commit the
behaviour change.
