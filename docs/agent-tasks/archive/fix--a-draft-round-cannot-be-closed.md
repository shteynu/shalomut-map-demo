# A draft round cannot be closed, and says so in Hebrew

## Metadata

- Branch: `fix/a-draft-round-cannot-be-closed`
- Base branch: `fix/draft-round-is-not-a-previous-round`
- Base commit: `d4255c7`
- Current HEAD: see `git log -1`
- Status: landed on `origin/main` as `805d7dd`, archived 2026-08-09
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Finding 3 of the 2026-08-09 deployed end-to-end smoke, in
`docs/deployed-e2e-smoke-findings-2026-08-09.md` on
`test/deployed-e2e-smoke-2026-08-09`.

**Stacked, not independent.** It is branched from the findings 1–2 fix rather
than from `main`, because both land by pushing the branch onto `main` and two
branches cut from the same commit cannot both do that. Push this one and both
arrive; push them in order if they are wanted separately.

## User-visible outcome

- Pressing `סגירת סבב אבחון ידנית` on a round that cannot be closed is no longer
  possible, and the button says why it is unavailable.
- When closing does fail, the manager reads a Hebrew sentence about their round
  instead of the API's English sentence about its own state machine.

## Context

`draft → closed` is not a transition the round state machine has: a draft has
collected nothing, so it opens or it is filed away. The route refuses it with a
`409` — correctly — but the screen offered the button anyway, and printed the
refusal verbatim:

> Transition from 'draft' to 'closed' is not allowed.

Two defects in one press. The button existed because the screen kept its own
list of the statuses closing works for (`closed || closing || archived`), which
had drifted from the route's list. The English existed because `closeRound` read
`payload.error` off the response, which `archiveRound` beside it already knew
not to do — its comment says so: the API's wording is for the log, not the
screen.

## Decisions made

- **One transition table, in `src/lib/rounds/round-status.ts`.** The rule now
  has a single home that both a route handler and a client component can import.
  `RoundService.isTransitionAllowed` delegates to it and keeps its signature, so
  every existing caller is untouched. Putting it in `lib/rounds` rather than
  leaving it in `RoundService` is what lets the screen ask instead of guess:
  `round-controls.tsx` is a client component, and pulling a service that reaches
  the repository interfaces into the browser bundle to answer one boolean is the
  wrong trade.
- **Disabled, not hidden.** `round-archive-action.test.tsx` already fixed this
  convention for archived rounds — the button stays, greyed out — so a draft
  behaves the same way rather than inventing a second one. A `title` explains
  it, since a greyed button with no reason is its own small puzzle.
- **The route keeps answering in English.** It is refusing a transition to a
  caller; the screen is what talks to a person. `closeFailureMessage` maps the
  status code, exported so the copy is testable on its own.
- **`409` is now a race, and the copy says so.** With the button gated on the
  round's status, the only way left to reach a refusal is that the round changed
  since the page was rendered — so the message asks the manager to refresh.

## Non-goals

Findings 4, 5, 6 and the delta-chip nit.

## Changed files

- `src/lib/rounds/round-status.ts` — new, the transition table
- `src/lib/services/round.service.ts` — delegates to it
- `src/components/round/round-controls.tsx` — `closable`, `closeFailureMessage`
- `src/components/round/__tests__/draft-round-close-action.test.tsx` — new

## Verification evidence

### Passed

- `npm run verify:core` exit 0: 754 TypeScript tests (748 before, six new), all
  five fitness checks, `npm run typecheck`, ESLint and the production build.
- `npx playwright test e2e/` 9/9 — the committed suite is unchanged and still
  writes nothing.
- The regression fails against the pre-fix code: restoring
  `disabled={closed || closing || archived}` fails "a draft round cannot be
  closed, so its close button cannot be pressed" (5 pass, 1 fail).
- **Walked in a browser, on a real draft round.** A one-off Playwright spec
  signed in against a production build, created a draft through
  `POST /api/rounds`, and opened `/round?round=<id>`. It confirmed, on screen:
  no `זהו סבב קודם` banner, `איפוס נתונים` and `רענון ניתוח` both present, and
  `סגירת סבב אבחון ידנית` greyed out. Invoking the close handler anyway — the
  press a manager used to be able to make — produced `PATCH …/api/rounds/<id>`,
  a `409`, and on screen:

  > מצב הסבב השתנה מאז טעינת הדף, ולכן לא ניתן לסגור אותו כעת. רעננו את הדף כדי
  > לראות את מצבו העדכני.

  The same run is also the browser confirmation that the findings 1–2 branch
  recorded as missing: a draft is no longer announced as a round the school has
  moved past.

### Not run, and why it matters here

- **The spec above is not committed and its DOM half has no permanent guard.**
  It writes a round to the database, and the committed e2e suite's stated
  property is that it leaves the database as it found it. Recreating it as a
  standing test means giving that suite a fixture and a cleanup path, which is a
  larger change than this fix.
- What that leaves uncovered is one line: that `closeRound` calls
  `closeFailureMessage` rather than reading `payload.error` again. The copy
  itself is unit-tested, including that no failure path puts Latin script on the
  screen; the call site is covered by the browser run above and by review.
- The six temporary draft rounds the run created were deleted from the local
  database afterwards; it is back to the four rounds `seed-local.ts` puts there.
- `verify:db`, `verify:ai`, the Python suite and the mutation run: no schema,
  repository, contract, Python or mutated module is in this diff.

### Environment

local

### Residual risk

- `isRoundTransitionAllowed` is now imported by a client component. It is a pure
  function over a literal table, so nothing follows it into the browser bundle,
  but it is the first import of its kind from `lib/rounds` into a `"use client"`
  file and worth not treating as a precedent for services.

## Approval gates

None.

## Next concrete step

Push, and confirm on the deployed endpoint that `סבב שני E2E` — a draft in
`בית ספר בדיקת E2E` — shows the close button greyed out rather than failing in
English.
