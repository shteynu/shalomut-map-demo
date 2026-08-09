# The builder's round switcher reads the save that just happened

## Metadata

- Branch: `fix/builder-switcher-reads-the-save`
- Base branch: `fix/a-draft-round-cannot-be-closed`
- Base commit: `805d7dd`
- Current HEAD: see `git log -1`
- Status: landed on `origin/main` as `d6fc66f`, archived 2026-08-09
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Finding 4 of the 2026-08-09 deployed end-to-end smoke, in
`docs/deployed-e2e-smoke-findings-2026-08-09.md` on
`test/deployed-e2e-smoke-2026-08-09`.

**Third in a stack.** Branched from the finding-3 fix, which is branched from
the findings 1–2 fix. All three land by pushing onto `main`, and branches cut
from the same commit cannot each do that. Pushing this one lands all three.

## User-visible outcome

After saving the questionnaire, the round switcher beside the form shows which
round is now running, instead of the arrangement from before the save.

## Context

Saving the questionnaire is what activates the round, and activating a round
closes the one that was running — one active round per school. The switcher is
server-rendered and was built before any of that, so it went on offering the
round the save had just closed as `פעיל` and the round the save had just started
as `טיוטה`: the exact inversion of what the school had. The API already reported
the new statuses. A full page load corrected it.

Same class as `c67471c` and `a0f5306`, and the same class of remedy the setup
form already uses: a server-rendered control that a client-side write changed
underneath.

## Decisions made

- **`router.refresh()`, following `setup-form.tsx`.** It is the pattern this
  repository already has for exactly this — a client write that changes what a
  server component rendered — and reaching for anything else would mean two
  answers to one question.
- **Refresh, not remount.** `SurveyBuilder`'s key is the round id and does not
  change, so the questionnaire held in state, the save confirmation and the note
  naming the round that was closed all survive; only the server-rendered parts
  are rebuilt. `initialDefinition` and `lastSavedAt` seed state at mount only,
  so the new props do not overwrite what the manager is looking at.
- **Unconditional, on every successful save.** `setup-form` does the same. A
  save that closed nothing costs one server render; a rule for when to bother
  would be a second place for this to be wrong.

## Non-goals

Findings 5 and 6, and the delta-chip nit.

## Changed files

- `src/components/survey/survey-builder.tsx` — `useRouter`, and
  `router.refresh()` at the end of `saveDefinition`

## Verification evidence

### Passed

- `npm run verify:core` exit 0: 754 TypeScript tests, all five fitness checks,
  `npm run typecheck`, ESLint and the production build.
- `npx playwright test e2e/` 9/9 — the committed suite is unchanged.
- **Walked in a browser, both ways.** A one-off Playwright spec signed in
  against a production build, opened the builder on a draft round whose
  questionnaire was complete, and read the switcher before and after pressing
  save, with no reload in between:

  before — `סבב חורף 2027 — פעיל`, `טיוטה זמנית לבדיקת ראיות — טיוטה`
  after — `טיוטה זמנית לבדיקת ראיות — פעיל`, `סבב חורף 2027 — סגור`

  With `router.refresh()` removed and the application rebuilt, the same spec
  fails: the switcher keeps the before arrangement.

### Not run, and why

- **There is no permanent test for this.** The behaviour only exists once the
  page renders and a write completes, so it cannot be reached without a browser;
  and reaching it in a browser means activating a round, which the committed e2e
  suite must not do — its stated property is that it leaves the database as it
  found it. No unit test in this repository mocks `next/navigation`, so
  `setup-form.tsx`'s identical `router.refresh()` has no test either. The guard
  is the one-off run above and the precedent it follows.
- `verify:db`, `verify:ai`, the Python suite and the mutation run: no schema,
  repository, contract, Python or mutated module is in this diff.

### Environment

local

### Local database

The evidence runs created a draft round, activated it, and so closed the seeded
`סבב חורף 2027`. Both were undone afterwards: the temporary round is deleted and
the seeded round is `active` again, leaving the four rounds `seed-local.ts`
puts there.

### Residual risk

- A refresh on every save is one extra server render per press. On a screen
  where the manager saves repeatedly while editing, that is a request each time.
  It matched `setup-form`'s behaviour and no latency was noticeable in the walk,
  but it is the thing to look at first if the builder ever feels slow to save.

## Approval gates

None.

## Next concrete step

Push, then save a questionnaire on the deployed endpoint and confirm the
switcher names the new round as `פעיל` without a reload.
