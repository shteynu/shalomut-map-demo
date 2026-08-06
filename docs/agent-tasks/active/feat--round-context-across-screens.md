# The round a manager is reading follows them across the screens

## Metadata

- Branch: `feat/round-context-across-screens`
- Base branch: `main`
- Base commit: `ddd6be3`
- Current HEAD: `6d00328`, three commits ahead of `origin/main`
- Status: implemented and verified at test level; the browser walk and the push
  are the owner's
- Last updated: 2026-08-06
- Last agent/tool: Claude Code (Opus 5)

## Objective

Opening a new round must not make the previous one unreachable. The selected
round becomes a context the manager screens carry, rather than a parameter only
the map knows about.

## User-visible outcome

A manager who opens a new round can go back to the previous one from any manager
screen, stay on that round while moving between screens, and read it without
being offered actions that would rewrite it.

## Context

Reported by the owner at the start of the 2026-08-06 session: "when I open a new
round I cannot return to the previous one".

The mechanism was already half built. Every manager page reads `?round=`
(`readRoundParam`), and `ManagerContextService` resolves any round of the
school, refusing only ids from another school. What was missing was every way
in: the switcher existed on the dashboard map alone
(`dashboard-round-switcher.tsx`), and the header nav emits bare hrefs, so the
first click on `מעקב סבב אבחון` or on the brand mark dropped the round and
landed the manager back on the active one.

Activating a round closes the previous one (one active round per school, owner
decision 2026-08-03), so the previous round is `closed` and already listed by
the switcher — it was only unreachable from anywhere but the map.

## Scope

- The round switcher becomes a manager-wide component rather than a dashboard
  one, and each screen links to itself with the other round.
- The switcher renders on the home screen, `/round` and `/survey`, beside the
  map that already had it.
- The header nav carries the selected round to the round-scoped screens.
- A superseded round — one that is no longer the school's current round — is
  read-only on `/round`: no reset, no re-analysis.

## Non-goals

- `/setup` does not become round-switchable. It configures the round the school
  is working on; a past round is not configured, and a read-only setup form is
  a different slice.
- Goals stay school-wide and outside the round context (ADR-018).
- No change to which rounds exist, to the one-active-round rule, or to what the
  archive does.

## Acceptance criteria

- From the home screen, `/round`, `/survey` and the map, a manager can select
  any round of the school, including the archive.
- Moving between those screens through the header keeps the selected round.
- `/round` for a superseded round offers no button that rewrites it.
- The privacy threshold and the locked states are untouched.

## Relevant repository instructions

- `AGENTS.md`, mandatory progress handoff.
- `shalomut-map`: prefer existing components and tokens; RTL first; WCAG AA;
  status never by colour alone.

## Decisions made

- **The switcher links to the current screen, not to the map.** Switching
  rounds on `/round` stays on `/round`. A switch that always landed on the map
  would be a navigation the manager did not ask for.
- **"Read-only" means superseded, not closed.** A round that is closed but
  still the newest one keeps its reset and its re-analysis: closing and then
  refreshing the analysis is the normal end of a round. What becomes read-only
  is a round the school has moved past, which is the case the owner reported.
- **Archiving stays available on a superseded round.** Filing a round away does
  not rewrite what it measured, and a superseded round is exactly the one a
  manager wants to file.

## Assumptions

- The owner pushes this branch.

## Completed

All of the scope, in three commits on this branch:

- `485ce9a` the switcher moves out of the dashboard and takes a route builder,
  so each screen links to itself with another round.
- `1ee6e12` the switcher renders on home, `/round` and `/survey`; the header
  and the home action cards carry the round.
- `6d00328` a superseded round is read on `/round`.

## In progress

Nothing.

## Remaining

The signed-in browser walk, which needs credentials the agent does not enter.

## Changed files

- Moved: `src/lib/dashboard/round-options.ts` → `src/lib/rounds/round-options.ts`;
  `src/components/dashboard/dashboard-round-switcher.tsx` →
  `src/components/round/round-switcher.tsx`, with its test.
- `src/lib/navigation.ts`: `homeRoute`, `routeHrefForRound`,
  `mainNavItemsForRound`, and `getNavigationAction` takes a round.
- `src/lib/services/manager-context.service.ts`: `isSelectedRoundCurrent`.
- `src/components/layout/app-header.tsx`: reads the round from the URL behind a
  Suspense boundary, so no statically rendered route has to become dynamic.
- `src/app/page.tsx`, `src/app/round/page.tsx`, `src/app/survey/page.tsx`,
  `src/app/dashboard/page.tsx`, `src/components/survey/survey-builder.tsx`,
  `src/components/round/round-controls.tsx`, `src/app/globals.css`.
- Tests: `src/components/round/__tests__/superseded-round-controls.test.tsx`
  (new), `round-switcher.test.tsx`, `src/lib/__tests__/navigation.test.ts`.
- `PROGRESS.md`, this file.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 619 tests, 619 pass; lint clean; build clean,
  and `/login` is still prerendered as static, which is what the Suspense
  boundary around the header's round read is there to protect.
- Local database read read-only through the composition root: the school has
  four rounds — one active and three closed — so the reported scenario exists
  locally and the switcher has something to switch between.

### Failed

None.

### Blocked or not run

- The signed-in browser walk. Every manager screen is behind the login form,
  and the agent does not enter passwords. The dev server ran and served
  `/login`; nothing past it was opened. This is the same boundary the
  2026-08-05 handoff recorded for the three newest manager screens.
- `verify:db` and `verify:ai` — no schema, repository, contract or Python
  change in this diff.

### Environment

Local.

### Residual risk

The rendering evidence is component-level: the switcher, the header hrefs and
the superseded controls are proved by tests, not by a walk. What a walk would
add is layout — the switcher sits in three new places, and only the map's
placement has ever been seen.

## Failed approaches

None.

## Known risks

- `align="start"` on the three new placements is unreviewed by eye. It follows
  the RTL flow of each page rather than the map's centred column, which is the
  right default, but nobody has looked at it.

## Approval gates

- Unchanged and still open: rotating the four design-stage credentials before
  the first real respondents.

## Questions requiring an owner decision

None open on this branch.

## Next concrete step

The owner signs in on the local dev server so the walk can run — home, `/round`
and `/survey`, switching to `סבב סתיו 2026` and back, checking that the header
keeps the round and that the tracking screen of a superseded round offers no
reset and no re-analysis. Then the push:
`git push origin feat/round-context-across-screens:main`.
