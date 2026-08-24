# The administrator console's specs stop reading a page mid-navigation

## Metadata

- Branch: `fix/the-admin-pager-goes-back-to-a-page-that-exists`
- Base branch: `main`
- Base commit: `0f3af25`
- Current HEAD: `5912772`, which is `origin/main`
- Status: **closed** — landed on `main` as `5912772` on 2026-08-24, archived
- Last updated: 2026-08-24
- Last agent/tool: Claude Code (Opus 5)

## Objective

Stop `e2e/administrator-console.spec.ts` from failing intermittently on a
correct product. It failed three times during the session of 2026-08-24, each
time on the same line, and each time reporting that the first page of schools
held no schools at all.

## User-visible outcome

None. Nothing in the product changes; a test stops lying about it.

## Context

The failure was met while verifying an unrelated branch, and the first theory
about it was wrong in a way worth recording: it failed twice in a row
immediately after a database reset, so it was reported — in the archived task
file of that branch, and in a spawned follow-up — as failing "against a freshly
reset local database". That reproduction did not hold. Twenty-four runs on a
fresh database passed, and twenty-four more under deliberate CPU load passed
too. What the three failures have in common is not the database; it is that each
happened while the machine was busy with something else.

## The defect

Three assertions read the rendered card list immediately after an action that
navigates:

- `expect(await cardNames(page)).toEqual(first)` after clicking the pager's
  "previous" link — the one that failed.
- `expect(await cardNames(page)).toEqual([…])` after submitting the search.
- `expect((await cardNames(page)).length).toBeGreaterThan(1)` after clicking
  "clear", with no wait of any kind before it.

Every one of those is a real document navigation: the pager is an `<a href>`,
the search is a `GET` form, and the page is rendered on the server. `toHaveURL`
resolves when the address agrees, which is not when the new document has
rendered — and `allInnerTexts()` does not retry. Read in the gap between the
two, the list is empty, which is exactly what the failure reported: `Array []`
where twenty school names were expected.

The failure artefacts were overwritten by later passing runs before they could
be re-read, so this is diagnosis by elimination rather than from a captured
snapshot. It is the only explanation consistent with the evidence: the empty
list was read one line after the same list had been read successfully from the
same page, and no product path renders an empty first page of a platform that
has twenty-five schools.

## Scope

`e2e/administrator-console.spec.ts` only. No product code.

## Non-goals

- Adding a `waitForLoadState` or a timeout. A sleep would hide the race at a
  cost per run; a retrying assertion removes it.
- The 25 fixture schools this spec leaves behind. That is deliberate and
  recorded in the handoff.

## Decisions made

**Every read of the card list became a locator assertion**, which retries. The
guards were chosen to be the property under test rather than a proxy for it:

- Back from page two asserts `toHaveText(first)` — the guard and the assertion
  are the same statement.
- Forward to page two first asserts that the leading card is *not* page one's,
  which is both "the new document is here" and the disjointness the test exists
  to prove.
- Clearing the search asserts the exact list the search started from, captured
  at the top of the test. The old assertion — "more than one card" — would have
  been satisfied by a stale document still showing the pre-search page, so this
  is stronger as well as race-free.

## Completed

All of Scope. `expect(await …)` no longer appears anywhere under `e2e/`; those
three were the only instances.

## Verification evidence

### Passed

- `npx playwright test e2e/administrator-console.spec.ts --repeat-each 8` —
  24 runs, 24 pass.
- `npx playwright test` — the whole suite, 27 pass, including the spec that
  failed earlier in the day.
- `npm run verify:core` — exit 0.

### Blocked or not run

**The fix cannot be proven by its own green runs.** The unfixed spec also passes
24 idle runs and 8 runs under load; the flake did not reproduce on demand after
the three failures that started this. So the evidence is the shape of the code,
not the count: an unguarded read of a page mid-navigation can return an empty
list, three such reads existed, and none does now. A retrying assertion is
strictly stronger than a single read, so this cannot be worse.

### Environment

Local Postgres on `5433`, seeded with `scripts/seed-local.ts --reset` under
`MANAGER_ORGANIZATION_ID=local-dev-organization`, which is what the browser
suite needs.

## Known risks

If this spec fails again on the same line, the diagnosis above is wrong and the
next reader should keep the artefacts: `test-results/**/error-context.md` holds
the page snapshot at the moment of failure, and later runs delete it.

## Next concrete step

None. The branch landed and this file is archived. If the spec fails again on
the same line, see Known risks above — keep the artefacts before re-running.
