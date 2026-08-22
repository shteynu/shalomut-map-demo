# The tenant boundary gets a browser test

## Metadata

- Branch: `test/multi-tenancy-in-the-browser`
- Base branch: `main`
- Base commit: `a96b971` (also `origin/main`, and deployed)
- Landed as: `a16406f` (spec and fixtures) and `c40fb94` (this file), both on
  `origin/main`
- Status: done, verified and landed; archived
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Cover the tenant boundary in a real browser. Every rule about which school a
manager may read is enforced in `src/middleware.ts` and proved only by unit and
API tests; no Playwright spec has ever opened a second school or signed in as a
platform administrator.

## User-visible outcome

None. This adds tests.

## Context

The gap was named while auditing multi-tenancy coverage on
`feat/what-the-administrator-sees` and deliberately left open there. The
boundary itself is one expression in middleware — `mayOpen`, built from
`isPlatformAdministrator` and the session's memberships — and everything below
reads the headers it sets. A defect there is invisible to every existing browser
spec, because all of them sign in as one manager of one school and never ask for
another.

## Scope

- `e2e/tenant-boundary.spec.ts` — the new spec.
- A fixture for a second school, created by the spec through the same
  repositories the application uses.
- Whatever helper the administrator case needs to hold a session the password
  door cannot issue.

## Non-goals

- The sign-in door itself. `login-transition.spec.ts` and `rate-limit.spec.ts`
  own it, and this spec's subject starts after the session exists.
- OIDC. Identity comes from Google in the deployed runtime, but the local one
  has no provider, and standing one up would make this spec about the door
  rather than the boundary.
- Turning the smoke into a suite. The harness is deliberately one path; this
  adds one more, about the one thing no path covers.

## Acceptance criteria

- A manager who is a member of one school cannot reach another by asking for it
  in the URL.
- A platform administrator can open a school they do not belong to, and the
  visit is recorded.
- The administrator area is refused to a manager who is not one.
- Each assertion is watched failing against a deliberately broken tree before it
  is trusted.

## Relevant repository instructions

- `AGENTS.md`: never expose respondent identity or results below the privacy
  threshold — not at risk here, but the fixtures must not create a school that
  publishes anything.
- Verification proportional to risk; auth and authorization changes call for
  organization-isolation tests, which is exactly what this is.

## Relevant architecture and contracts

- `src/middleware.ts` sets `MANAGER_ORGANIZATION_HEADER` and
  `MANAGER_MEMBER_SCHOOLS_HEADER`; `EVERY_SCHOOL` (`*`) is the administrator's
  membership list.
- The two chokepoints below it — `loadManagerContext` and
  `authorizeManagerRound` — record `ADMINISTRATOR_SCHOOL_VISIT` and fail closed.
  `npm run lint:tenant-chokepoints` keeps every path going through them.
- `playwright.config.ts` starts its own `next start` with a password, a session
  secret and `MANAGER_ORGANIZATION_ID=local-dev-organization` it invents. The
  password door yields only non-administrator accounts, all members of that one
  school — see `ManagerAuthenticationService.defaultAccounts`.

## Decisions made

- **A second Playwright server, not a setting on the first.** The smoke server
  has no identity provider, and with none configured
  `SessionRenewalService.readDirectory` reads the password accounts rather than
  the database. None of those accounts is a platform administrator, so an
  administrator minted into a cookie is signed out on the first activity event —
  watched happening, with `USER_NOT_FOUND` in the server log. Configuring a
  provider makes the directory the database, and also closes the password door
  that every other spec signs in through. Hence a second server on 3101 with
  four provider values that point nowhere: nothing ever calls the issuer, and
  what they buy is the directory behaviour.
- **Both sessions are minted, not signed in.** Once the administrator has to be
  a database row, the member may as well be one too — it makes both sides of the
  boundary read the way the deployment reads them, and keeps this file's subject
  to the boundary rather than the door. The doors have their own specs.
- **`/setup/` is the screen, not `/`.** It names the school it is showing in a
  labelled field, with or without a round. `/` says nothing identifying until
  the school has a round, and giving the second school one would enter it into
  the one-active-round-per-school rule.
- **The second school has no round and no responses.** It exists to be refused
  and to be opened; anything else would make it a fixture the other specs could
  trip over.
- **`e2e/local-database-url.ts` instead of `import 'dotenv/config'`.** Loading
  the whole `.env` in a worker takes `SESSION_SECRET` from the developer's file
  while the server was started with the config's fallback, so the minted token
  fails verification and every page redirects to `/login`. The file takes one
  variable and leaves the rest of the process alone.

## Assumptions

- CI runs `db:migrate:deploy` and `db:seed:local` before Playwright, so the
  spec may create its own second school in the same database.

## Completed

Everything in Scope.

## In progress

Nothing.

## Remaining

Nothing. The push happened on 2026-08-21.

## Changed files

Added: `e2e/tenant-boundary.spec.ts`, `e2e/tenant-fixtures.ts`,
`e2e/local-database-url.ts`, and this file — added under
`docs/agent-tasks/active/` and moved to `archive/` on 2026-08-22.

Modified: `playwright.config.ts` (second server, second project, exported
session secret and base URL), `.github/workflows/browser-smoke.yml` (the comment
and the step name), `PROGRESS.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- `npx playwright test` — the whole browser suite, both projects: **23 passed**,
  0 failed. The nineteen that existed before are untouched.
- **Each of the four new checks was watched failing, one mutation each**, and
  the tree was restored to a clean `git status` after every one:
  1. `mayOpen` returns true for everybody → only "a manager asking for a school
     they are not in stays where they are" fails.
  2. the administrator-area gate never fires → only "a manager who is not an
     administrator is turned away" fails.
  3. the gate fires for everybody, administrators included → only "an
     administrator reading a school is not the same as belonging to it" fails.
  4. `loadManagerContext` stops calling `recordManagerScreenVisit` → only "an
     administrator may open a school they do not belong to, and it is written
     down" fails.
  One mutation per check and one check per mutation: no test is redundant and
  none is vacuous.
- `npm run verify:core` unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1358 / # pass 1358 / # fail 0`, no `not ok`, ten fitness checks
  passing.
- After the documentation edits that followed it: `npx tsc --noEmit` clean,
  `npm run lint` exit 0, `npm run lint:doc-numbers` exit 0.

### Failed

None that survived. Two fixture defects were found by watching them fail and are
recorded under Decisions and Failed approaches.

### Blocked or not run

- Nothing on the deployed endpoint. This task adds tests and changes no runtime
  code, so there is nothing there to check.
- The provider's own sign-in flow is not walked. No test can: it would need
  Google.

### Environment

Local, against the loopback development database and two production builds the
run starts itself.

### Residual risk

Low, and named. The spec writes three rows — a school, an administrator and a
member — into the database the other specs share. They are created only when
missing, carry fixed ids, and the school has no round, so they cannot take the
active-round slot the smoke depends on. A developer's local database keeps them
after a run; `db:seed:local --reset` clears them like anything else.

## Failed approaches

- **Minting an administrator against the smoke server.** Rejected by the product
  on the first session renewal, because a runtime with no identity provider
  reads its directory from the password accounts. Not a fixture that needed
  fixing — a runtime that cannot hold an administrator.
- **Giving the administrator a database row and nothing else.** Same failure for
  the same reason: the row is invisible to a directory that is not the database.
  The row is still needed, and the second server is what makes it visible.
- **`import 'dotenv/config'` in the fixtures.** Silently replaced the session
  secret in the worker and made every minted session unverifiable.

## Known risks

A browser spec that creates rows in the database it shares with the other specs
can make the smoke order-dependent. The fixture must be identifiable and must
not take the active-round slot of the school the other specs use.

## Approval gates

None. Unchanged: `GEMINI_API_KEY` awaits the owner's rotation.

## Questions requiring an owner decision

None open.

## Next concrete step

None. The push happened: `a16406f` and `c40fb94` are on `origin/main`, and
`e2e/tenant-boundary.spec.ts` is in the tree. No deploy check was needed — the
branch adds tests and documentation and changes no runtime code, so
`/api/health/` moved to the new tip with no behaviour to re-verify.
