# An administrator asks for a page, not for the platform

## Metadata

- Branch: `feat/an-administrator-asks-for-a-page-not-the-platform`
- Base branch: `main`
- Base commit: `75d6e7b`
- Current HEAD: see **Exact Git state**
- Status: complete and verified
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the second half of the 2026-08-21 audit's «Обзор администратора делает ~3
последовательных запроса на каждую школу» — pagination and server-side search in
the administrator console. The first half (a constant number of queries) closed
on 2026-08-22 as `e056d21`/ADR-036 and explicitly left this open.

## What was wrong

The screen made a constant number of queries and every one of them read a whole
table: every school, every manager, every membership, every round summary — all
of it rendered into one page of cards. **A constant number of unbounded queries
is the same screen with a slower failure.** The earlier fix removed the timeout
and left the size of every answer exactly where it was.

## Decisions made

1. **The page lives in the URL — `?q=` and `?page=`.** The rows a client would
   page are not in the client, and every mutation on this screen calls
   `router.refresh()`, which re-runs the server read with the same page and
   search. Inviting somebody therefore does not throw the administrator back to
   the top of the list.
2. **The lists that are not about schools are asked for, not derived.** This is
   the whole substance of the change. `unattached` and `administrators` were
   computed by subtracting the loaded memberships from every loaded manager, and
   subtraction is only correct while both operands are complete. With twenty
   schools on screen, a person attached to a school on page four looks exactly
   like a person attached to nothing. `findManagersWithoutStandingMembership`
   (a `NOT EXISTS` over memberships) and `findPlatformAdministrators` moved the
   question to the store.
3. **`findAllManagers` is deleted from the interface, not deprecated.** One
   caller, and it was the only query in the product that returned every person
   who may sign in. Keeping it would keep the cheapest way to write the next
   screen that enumerates everybody.
4. **The search escapes `%`, `_` and `\`.** ADR-044's reading of `ILIKE`,
   arriving as a wrong answer rather than as a way past a gate — the caller is
   already an administrator, which is exactly why it would have gone unnoticed.
5. **`ORDER BY created_at DESC, id DESC`.** The seed creates schools in one
   millisecond, and `OFFSET` over a partial order may repeat a school and lose
   another.
6. **The two people lists are capped at 50 and say so**, rather than paged. One
   extra row is read to detect the tail and is not rendered. The honest answer
   to a hundred people with no school is that something needs cleaning up.
7. **The `page` object was admitted past the k-anonymity guard deliberately.**
   `administrator-school-overview.test.ts` refuses any platform-wide field on the
   overview. `page` is one, on the narrow ground that a school is not a person —
   it is the same cardinality the heading always showed, now correct on page two.
   The test now names its fields one by one, so a `page` that one day carried
   `totalResponses` would fail rather than pass by having the right type.

## Changed files

- `src/lib/repositories/interfaces.ts` — `OrganizationPageQuery`,
  `OrganizationPage`, `findPage`; `findAll`'s doc rewritten to name its
  remaining callers.
- `src/lib/repositories/prisma/prisma-organization.repository.ts` — `findPage`
  and `asLiteralSubstring`; `prisma-client.ts` — `organization.count`.
- `src/lib/repositories/in-memory/in-memory-organization.repository.ts` — the
  twin.
- `src/lib/auth/domain-contract.ts` — `findManagersByIds`,
  `findPlatformAdministrators`, `findManagersWithoutStandingMembership` replace
  `findAllManagers`, on the interface and on the in-memory store.
- `src/lib/repositories/prisma/prisma-manager.repository.ts` — the three twins.
- `src/lib/auth/manager-administration-service.ts` — page types, the URL reader,
  the clamp, `bounded`, and `loadOverview` rewritten around the page.
- `src/app/admin/page.tsx` — `searchParams`; `src/components/admin/admin-console.tsx`
  — search form, pager, truncation note; `src/app/globals.css` — their styles.
- `playwright.config.ts` — the tenant-boundary project now hosts two specs.
- Tests: new `an-administrator-asks-for-a-page-not-the-platform.test.ts` (13),
  new `__dbtests__/postgres-organization-pages.test.ts` (10), new
  `e2e/administrator-console.spec.ts` (3); restated
  `an-administrator-overview-is-a-constant-number-of-queries.test.ts`,
  `administrator-school-overview.test.ts`,
  `manager-administration-service.test.ts`,
  `the-store-refuses-a-second-school-user.test.ts`,
  `repositories/__tests__/prisma.test.ts`.
- `PROJECT_CONTEXT.md` ADR-052, `PROGRESS.md`,
  `docs/critical-audit-2026-08-21.md`.

## Tests that were restated rather than left alone

Two prior tasks' assertions were rewritten, which is how a suite quietly
weakens, so both are named here:

- **`an-administrator-overview-is-a-constant-number-of-queries.test.ts`** asserted
  that twenty-five schools produce twenty-five cards. That is now false by
  design. It asserts the constant query count as before, and gained the half it
  never had: three hundred schools produce twenty, the total still says three
  hundred, and the read cannot be widened from the address bar.
- **`administrator-school-overview.test.ts`** listed the overview's allowed keys
  and refused any addition. See decision 7 above for why `page` was added and
  what was added with it so the guard did not merely get looser.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, **1614 tests, 1614 pass**, zero `not ok`,
  production build included.
- `npm run verify:db` — exit `0`, **107 tests, 107 pass**, against the disposable
  PostgreSQL on `127.0.0.1:5433`.
- `npm run test:e2e` — exit `0`, **27 passed**, including the three new console
  specs on the tenant server.
- **Six deliberate regressions were planted and every one was caught.** Written
  down because a test that has never failed on purpose is a test that agrees
  with itself:
  1. `unattached` derived from every manager, ignoring memberships → the
     attached-on-another-page test failed.
  2. `bounded` rendering the extra row → the cap test failed.
  3. In-memory `findPage` returning insertion order → three tests failed.
  4. The search escape removed → both `ILIKE` dbtests failed.
  5. `skip` ignored in the Prisma page → the browser paging spec failed.
  6. The `id` tie-break removed → **caught nothing at first.** Forty-five
     untouched rows came back the same way twice, so the dbtest passed with and
     without it. The test now writes between page reads — PostgreSQL moves an
     updated row to the end of the heap — and fails without the tie-break. This
     one is the reason the discipline is worth the time.
- Browser walk of `/admin` as a platform administrator with 29 schools: page 1
  renders 20 cards and a pager, page 2 renders the rest with a «הקודם» link,
  the search narrows to one school and the pager disappears with it.

### Blocked or not run

- **Nothing was measured.** Unlike the two previous slices there is no
  before/after timing here: the claim is about how much a query may return, not
  how long it takes, and the row counts are asserted directly.
- **The deployed database was not touched**, and no migration was needed — this
  is entirely a change of what is asked for.
- The Python suite — not run; nothing on that side changed.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433` for `verify:db`; the Playwright
tenant server on its own port for the browser specs.

### Residual risk

- **`orgRepo.findAll` still backs one screen.** The school switcher a platform
  administrator sees on `setup` is a `<select>` of every school and grows without
  a ceiling. Named in the interface's doc comment and in ADR-052 rather than
  fixed: bounding it means a search field instead of a dropdown, which is a
  different screen.
- **`e2e/administrator-console.spec.ts` leaves 25 schools in the local
  database**, with fixed ids so repeated runs reuse them. Same trade
  `SECOND_SCHOOL` already makes, and it makes the developer's own `/admin` page.
- **The people caps are a guess.** Fifty is chosen, not derived — the product has
  no data on how many administrators a platform ends up with. It fails safe: the
  screen says it was cut short.
- **`skip`/`take` is offset paging**, not a cursor. A school created between two
  page reads shifts the boundary by one. The audit log got a cursor because it is
  written to while it is read; a list of schools is not, and the tie-break keeps
  a stable read stable.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin feat/an-administrator-asks-for-a-page-not-the-platform:main
```
