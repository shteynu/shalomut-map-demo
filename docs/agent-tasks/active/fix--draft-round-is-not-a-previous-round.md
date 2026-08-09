# A draft round is not a previous round, and `round=new` is not a round

## Metadata

- Branch: `fix/draft-round-is-not-a-previous-round`
- Base branch: `main`
- Base commit: `16df031`
- Current HEAD: see `git log -1`
- Status: complete, awaiting push
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Fix the two defects from the 2026-08-09 deployed end-to-end smoke that tell the
manager something untrue. Both are findings 1 and 2 in
`docs/deployed-e2e-smoke-findings-2026-08-09.md`, which lives on
`test/deployed-e2e-smoke-2026-08-09` — this branch is cut from `main` instead,
so the two can land in either order.

## User-visible outcome

- A round the manager has just opened reads as a round they are preparing, not
  as one the school has moved past, and keeps the controls for preparing it.
- Touching the menu while filling in a new round no longer lands on a screen
  saying the round was not found and may have been deleted.

## Context

Both were found by walking the deployed endpoint, and neither was visible to the
existing tests.

**Finding 1.** Opening a round while another one is still collecting creates a
draft; the draft goes live only once its questionnaire covers the eight
dimensions. `isSelectedRoundCurrent` asked whether the selected round was
`rounds[0]`, and `orderRoundsForManager` sorts `active` ahead of `draft`. So the
draft was never `rounds[0]` and the round screen read that as superseded: it
showed «זהו סבב קודם. בית הספר עבר לסבב חדש יותר… פתוח לקריאה בלבד» and
`RoundControls` hid `איפוס נתונים` and `רענון ניתוח`. Reproduced in two schools
on the deployed endpoint.

**Finding 2.** `/setup?round=new` uses `new` as a sentinel that only the setup
screen reads. `RoundAwareHeaderNavigation` took `?round` straight off the URL,
so every header link became `…?round=new`; `/round`, `/survey` and `/dashboard`
look that up as an id and render «הסבב המבוקש לא נמצא… ייתכן שהסבב נמחק».

## Decisions made

- **Superseded is a property of the round's own status, not of its position in a
  list.** `isSelectedRoundCurrent` is replaced by `isSelectedRoundSuperseded`,
  which requires both that the round is not the one the manager would land on
  *and* that its status is `closed` or `archived`. Renamed rather than negated
  in place, because the call site only ever wanted the superseded question and
  the old name invited exactly the conflation that caused the bug. It had one
  caller.
- **The sentinel is dropped in `navigation.ts`, not in the header.**
  `navigationRoundId` is where the reason belongs — beside `NEW_ROUND_PARAM` and
  `isNewRoundParam` — and being a pure function it is testable without a
  browser. The header calls it.
- **`readRoundParam` is left alone.** The setup screen has to keep seeing `new`;
  that is what the sentinel is for.

## Non-goals

- Findings 3–6 of the same document. Finding 3 in particular still stands: a
  draft round now shows the controls of a round being worked on, and among them
  `סגירת סבב אבחון ידנית`, which the route refuses with `409` and whose English
  error is printed into the Hebrew screen. That button was already offered
  before this change, so nothing here made it worse.

## Changed files

- `src/lib/services/manager-context.service.ts` — `isSelectedRoundSuperseded`
- `src/app/round/page.tsx` — the call site
- `src/lib/navigation.ts` — `navigationRoundId`
- `src/components/layout/app-header.tsx` — uses it
- `src/lib/services/__tests__/manager-context.service.test.ts` — six tests
- `src/lib/__tests__/navigation.test.ts` — three tests
- `e2e/new-round-navigation.spec.ts` — new, read-only

## Verification evidence

### Passed

- `npm run verify:core` exit 0: 748 TypeScript tests, all five fitness checks,
  `npm run typecheck`, ESLint and the production build.
- `npx playwright test e2e/` 9/9 against the local development database,
  including the two new browser tests.
- **Both regressions were proved to fail against the pre-fix code**, not merely
  asserted to pass against the new code:
  - restoring the old rule in `isSelectedRoundSuperseded` fails
    "a draft the manager just opened is not a round the school has moved past"
    (17/18 pass, 1 fail);
  - restoring the header's old read of `?round` fails
    "opening a new round leaves the menu pointing at real screens" (8/9 pass,
    1 fail).
- The new e2e spec writes nothing, so the run still leaves the database as it
  found it — the property `e2e/smoke.spec.ts` documents for itself.

### Failed

None.

### Blocked or not run

- `verify:db`, `verify:ai`, the Python suite and the mutation run: no schema,
  repository, contract, Python or mutated module is in this diff.
- **Finding 1 has no browser test and was not walked in a browser.** The local
  seed creates one closed round, so there is no draft to look at without writing
  one, and the smoke suite deliberately writes nothing. Its guard is the unit
  test above, which does fail on the old rule. The deployed database already has
  a draft — `סבב שני E2E` in `בית ספר בדיקת E2E` — so the fix can be confirmed
  on the endpoint by opening that round after the push, with no setup.

### Environment

local

### Residual risk

- Finding 1's fix is proved at the level of the rule, not of the rendered
  screen. The rendered half is one boolean away (`RoundControls` already has its
  own tests for both values of `isSuperseded`), but "one boolean away" is not
  the same as looked at.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
aliases are touched.

## Next concrete step

Push, then open `/round?round=<סבב שני E2E>` on the deployed endpoint and
confirm the banner is gone and the preparation controls are back.
