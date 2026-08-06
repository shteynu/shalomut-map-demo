# The round a manager is reading follows them across the screens

## Metadata

- Branch: `feat/round-context-across-screens`
- Base branch: `main`
- Base commit: `ddd6be3`
- Current HEAD: `9983184`, which is `origin/main`
- Status: done. Implemented, walked, pushed and deployed; the deployment was
  read and is `Ready`
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
  map that already had it, and is one select rather than a row of chips.
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
- **The switcher is a select, and still works without JavaScript** (owner
  request, 2026-08-06). Chips read well at three rounds and become a wall at
  twenty. The select sits in a `GET` form whose action is the current screen,
  so the no-JS path produces the same URL the chips linked to; the submit
  button lives in `noscript`, which needs no state to stay in step with
  whether scripting is on. ADR-018 is amended rather than contradicted: what
  it required was no-JS operation, not links.
- **The per-round `href` left the options.** Once the form's action carries the
  screen, a link per round was a second way to say the same thing.

## Assumptions

- The owner pushes this branch.

## Completed

All of the scope, in four commits on this branch:

- `485ce9a` the switcher moves out of the dashboard and takes a route builder,
  so each screen links to itself with another round.
- `1ee6e12` the switcher renders on home, `/round` and `/survey`; the header
  and the home action cards carry the round.
- `6d00328` a superseded round is read on `/round`.
- `c67471c` the three defects the walk found (below).
- The switcher becomes a select, in this slice.

## In progress

Nothing.

## Remaining

Nothing on this branch.

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
- `src/components/round/round-threshold-next-step.tsx`: the map link takes a
  round.
- `src/components/round/round-switcher.tsx` and `src/lib/rounds/round-options.ts`
  again, for the select; `roundSwitcherAction` in `src/lib/navigation.ts`;
  `PROJECT_CONTEXT.md` ADR-018 amended.
- Tests: `src/components/round/__tests__/superseded-round-controls.test.tsx`
  (new), `round-switcher.test.tsx`, `round-threshold-next-step.test.tsx`,
  `src/lib/__tests__/navigation.test.ts`.
- `PROGRESS.md`, this file.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0 with the select in place. 620 tests, 620 pass;
  lint clean;
  build clean, and `/login` is still prerendered as static, which is what the
  Suspense boundary around the header's round read is there to protect.
- Signed-in browser walk, local dev server, the owner signed in. The school has
  four rounds — one active and three closed:
  - Home, `/round` and `/survey` each render the switcher; selecting a round
    stays on that screen and the URL carries `?round=`.
  - The header moves the round between home, `/round`, `/survey` and the map;
    `setup` and `goals` stay bare, as intended.
  - `/round` for a superseded round: no reset, no re-analysis, archiving still
    offered, and the note explains why. The active round keeps both buttons —
    the regression check for "read-only means superseded, not closed".
  - The builder for a superseded round remounts on the switch: `סבב סתיו 2026`
    reads 0 questions and a disabled save, not the 24 questions of the round the
    manager came from.
  - Console clean after the fixes; before them it carried the duplicate-key
    error that exposed the second defect.
  - The select was walked on `/round` after the switch to it: choosing another
    round navigates on change, the screen arrives as that round, and the
    console stays clean.

### Failed

Three defects found by the walk, all fixed in `c67471c` and re-verified:

1. Stale client state across a round switch. Client navigation reuses a
   component, and `RoundControls` and `SurveyBuilder` seed state from the round
   they mounted with. Both are now keyed by the round.
2. The first fix used the bare round id as the key on two siblings, and React
   rendered both rounds' controls at once. The keys are now prefixed.
3. `RoundThresholdNextStep`'s map link was the bare dashboard route.

### Blocked or not run

- `verify:db` and `verify:ai` — no schema, repository, contract or Python
  change in this diff.
- The archive group was not walked: the local school has no archived round.
  Producing one means archiving a local round through a native `confirm()`,
  which froze the tab from the automation side, and a native `optgroup` is not
  worth mutating the owner's data for. It is covered by
  `round-switcher.test.tsx`. Nothing was archived — the attempt was checked
  against the database and all four rounds are unchanged.

### Environment

Local.

### Residual risk

Low. What the walk did not cover is the archive group and the no-JS path —
both are asserted in the rendered markup rather than exercised in a browser
with scripting off. The deployed environment carries one round, so its switcher
does not render at all.

## Failed approaches

- Keying both round-scoped components with the round id alone. They are
  siblings, so the duplicate key made React render both rounds at once — worse
  than the stale state it was fixing. Prefixed keys.

## Known risks

None outstanding. `align="start"` on the three new placements was reviewed by
eye during the walk and reads with the RTL flow of each page.

## Approval gates

- Unchanged and still open: rotating the four design-stage credentials before
  the first real respondents.

## Questions requiring an owner decision

None open on this branch.

## Next concrete step

Nothing on this branch. It is on `main` and deployed at `9983184`. Archive this
file when the next task opens.

The nearest useful thing the switcher has left undone: the deployed school has
one round, so nobody has ever seen the switcher there. Whoever opens a second
deployed round should look at it once.
