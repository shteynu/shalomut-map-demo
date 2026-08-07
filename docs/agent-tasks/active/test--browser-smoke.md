# One browser path, run by CI instead of by hand

## Metadata

- Branch: test/browser-smoke
- Base branch: main
- Base commit: d83cc10
- Current HEAD: the branch tip
- Status: green locally, red in CI and under diagnosis; committed locally, unpushed
- Last updated: 2026-08-07
- Last agent/tool: Claude Code (Opus 5)

## Objective

Automate the one path that only exists once a page renders: a manager signs in,
reads the round's share link, and a respondent opens it — plus the dashboard
deciding between a map and a lock.

## User-visible outcome

None. The application is unchanged; this is test infrastructure.

## Context

Every other check in the repository is blind to the browser. 733 unit and API
tests, 26 database integration tests and the Python suite cannot see a server
component that throws, a reading order that flipped, or a share link the
manager screen stopped showing. Until now that half was checked by hand, once
per session, by the owner with a signed-in browser — which is both a cost per
session and a check that only happens when someone remembers.

## Scope

Playwright, one spec of four cases, the `test:e2e` script, a CI step, and the
documentation of what it proves.

## Non-goals

- No broad end-to-end suite. Screens are still changing; a wide suite would
  cost more in maintenance than it catches.
- No visual regression or screenshot baselines.
- No coverage or score gate — declined earlier today, for reasons in
  `ROADMAP.md` and `docs/shalomut-tracker-handoff.md`.

## Acceptance criteria

All met:

- `npm run test:e2e` builds and runs the smoke from a clean shell: 4/4.
- The run needs no real secret, locally or in CI.
- The run writes nothing: no round is created, closed or answered.
- CI runs it after `npm run verify` and keeps the report when it fails.

## Decisions made

Three dead ends shaped the design, and each is recorded in
`playwright.config.ts` so nobody re-discovers them:

- **Production build, own server.** `next dev` cannot be used: Next 16 refuses
  a second development server in a directory that already has one, and reusing
  the developer's server made the run flaky in a way that looked like a product
  bug — the login page's client chunk is compiled lazily, so the first click
  submitted the form natively and no error ever appeared.
- **The run supplies its own credentials.** `NODE_ENV=production` makes
  `ManagerAuthenticationService` treat the run as deployed and demand
  `SESSION_SECRET`, `MANAGER_ADMIN_PASSWORD` and `MANAGER_ORGANIZATION_ID`, so
  the config starts the server with throwaway values it owns. The repository's
  real secrets are never read and CI needs none configured.
- **Those values are constants, not generated.** The config file is evaluated
  once in the runner and again in every worker, so a random password differed
  between the server that was started and the browser signing in — which fails
  as "wrong password" and reads like a broken login screen.
- **Selectors are accessible names**, never test ids. The application has no
  `data-testid` and states its meaning through labels and roles, which is what
  the RTL and WCAG AA commitments require anyway.
- **Sign-in navigates explicitly** rather than waiting for the form's own
  `router.push`. That client transition does not settle reliably under test,
  while the cookie is set and every protected page then answers 200 — so the
  smoke asserts the protected page renders, which proves the session more
  directly than watching the address bar.

## Assumptions

- The environment running the smoke has a database with at least one round.
  Locally that is the development database; in CI the step applies migrations
  and seeds the service database itself.

## Completed

- `playwright.config.ts`, `e2e/smoke.spec.ts` (4 cases), `@playwright/test` as
  a dev dependency, `test:e2e`, `.gitignore` for the run's output.
- `.github/workflows/deploy-vercel.yml`: browser install, the smoke step with
  its own `DATABASE_URL`, and the report uploaded on failure.
- `.agents/skills/shalomut-verification/SKILL.md`.

## In progress

- Nothing.

## Remaining

- The CI smoke is still red and its cause is unknown. The diagnostic is
  committed but useless until a run prints it.

## Changed files

`playwright.config.ts`, `e2e/smoke.spec.ts`, `package.json`,
`package-lock.json`, `.gitignore`, the workflow, the verification skill and
this task file. `.idea/shalomut-map-demo.iml` and `next-env.d.ts` were already
modified in the worktree and are left alone.

## Verification evidence

### Passed

- `npm run test:e2e` — 4/4 in about 8 seconds, after a clean `npm run build`.
- `npm run verify:core` — exit 0: 733 TypeScript tests, all five fitness
  checks, typecheck (which covers `e2e/` and the config), ESLint and the build.
  Run again after the seed fix, same result.
- `npm run db:seed:local` — reaches the database and creates rows. Against the
  already-seeded development database it then stops on the share-code unique
  constraint, which is the seed's own non-idempotence and not new: CI seeds an
  empty database, so the step is unaffected.

### Failed

- None now. Four intermediate failures were diagnosed rather than worked
  around, and each turned into a comment in the config or the spec: the dev
  server conflict, the unconfigured production auth, the 308 trailing-slash
  redirect being read as a refused login, and the per-process random password.

### Failed, then fixed

- **The CI step failed a second time, on `044c5b2` (run 31195236422), and is
  not yet diagnosed.** The seed fix worked — the step migrated, seeded and
  started the server — and then three of the four cases failed: sign-in returns
  200 and sets `shalomut_session`, the browser sends that cookie back, and the
  middleware redirects to `/login` anyway. The token in the CI trace verifies
  against the smoke secret, so the route signed it correctly; the middleware
  rejected it. Two reproductions could not make it happen: the same run on
  macOS without any `.env` file, and the same run inside
  `mcr.microsoft.com/playwright:v1.62.1-noble` on Linux with a fresh install,
  a fresh migrate and seed and a fresh build. Both pass 4/4, so the difference
  is the runner, not the code path. The middleware now says why it rejected a
  cookie, and the next CI run is what reads it.

- **The CI step failed on its first run** (`641e65b`, run 31191748609), and
  found a bug older than this task: `npm run db:seed:local` imported
  `getRepositories`, an export the composition root replaced, so the seed had
  been dying at its first line — invisible because a seeded database stays
  seeded and nobody re-seeds. `scripts/seed-local.ts` now calls
  `resolveCoreRepositories`, which is the entrypoint seam a script is supposed
  to use, and `npm run lint:composition` agrees.

### Blocked or not run

- `verify:db`, `verify:ai`, the Python suite and the mutation run — not run:
  no runtime file, schema, contract or mutated module changed.

### Environment

Local, against the development database.

### Residual risk

The smoke asserts that screens render and the flow connects, not that any rule
is correct. It also depends on the environment holding a round: with an empty
database the share-link case would fail rather than skip, which is the right
noise in CI and possibly the wrong noise on a fresh machine.

The CI step has now run twice and failed twice, each time for a different
reason. The first found a real bug. The second is not understood, and until it
is, the smoke proves nothing in CI — only locally, where it passes on two
machines and two operating systems.

## Failed approaches

- Reusing a running development server. It appeared to work and then failed on
  hydration timing; the failure looked like a product bug for two runs.
- A random per-run password. Correct instinct, wrong mechanism — see above.

## Known risks

- Playwright adds a dev dependency and a browser download to CI (~1 minute).

## Approval gates

- None beyond the standing one: pushing is the owner's action.

## Questions requiring an owner decision

- None.

## Next concrete step

Hand the push to the owner: `git push origin test/browser-smoke:main`, then
read the `[WebServer]` lines of the smoke step. One of two sentences will be
there: `session verification is unavailable in this runtime: …` means the edge
middleware cannot see `SESSION_SECRET` and the fix is to give the CI step its
own value at the job level; `the token did not verify` means the middleware
holds a different secret than the login route, and the fix is to stop the two
runtimes disagreeing. If neither line appears, the cookie never reached the
middleware and the trace in the `playwright-report` artifact is the next
thing to read.
