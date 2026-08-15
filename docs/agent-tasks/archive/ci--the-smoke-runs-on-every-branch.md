# The browser smoke runs on every branch

## Metadata

- Branch: `ci/the-smoke-runs-on-every-branch`
- Base branch: `main`
- Base commit: `171e1a4`
- Status: complete, merged to `main` (`4ad5977`), read back green, archived
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the gap that let a stale test land green. `verify-core.yml` runs on every
branch and carries no browser; the smoke was the last step of
`deploy-vercel.yml`, which triggers on `main` and on pull requests to it. Since
landings here are fast-forwards rather than pull requests, a branch met
Playwright for the first time *after* it was on `main`. On 2026-08-15 that is
exactly what happened — an eight-branch stack landed and the smoke went red on
the progress line's wording.

Owner decision, 2026-08-15: move the smoke, rather than route landings through
pull requests.

## What was built

**`.github/workflows/browser-smoke.yml`**, a third every-branch workflow.
`on: push` with no branch filter and `workflow_dispatch`, concurrency keyed by
ref with `cancel-in-progress`, the same shape `verify-core.yml` uses. It carries
its own Postgres 17 service on 5433, `npm ci`, a build, a Chromium install, then
`db:migrate:deploy`, `db:seed:local` and `npx playwright test`, and it keeps the
Playwright report as an artifact on failure.

Two choices inside it worth keeping:

- **A separate workflow, not a step of `verify-core.yml`.** That gate needs no
  database and no browser and is the fastest reporter in the repository; hanging
  Postgres and a Chromium install off it would slow the check that fails most
  often.
- **The build is its own step, outside the smoke step's `env`.** `npm run
  test:e2e` would build inside the smoke step and hand the build a
  `DATABASE_URL`, which is the one thing every gate here promises not to do. So
  `npm run build` runs first, without one, and the smoke step adds the
  connection for the migrate/seed/test line only.

It installs no Python and no virtualenv: nothing in this workflow crosses into
the AI service. That stays with `verify-core.yml` and `deploy-vercel.yml`.

**The steps left `deploy-vercel.yml`**, so `main` does not run them twice. That
workflow keeps `npm run verify` — `verify:db` and `verify:ai` included — and the
mutation dry run. Its job-level `SESSION_SECRET` went with the smoke, since it
existed only for it.

## Decisions

- **The manual deployment no longer waits on a browser.** `deploy-prod-manual`
  needs `validate`, which is now verify plus the mutation dry run. Stated in a
  comment in the workflow rather than left to be discovered. It costs little:
  the job is `workflow_dispatch`-gated and has never run on its own, Vercel
  deploys from its own Git integration, and the smoke's red X arrives at the
  same commit on its own workflow, usually sooner.
- **Three every-branch workflows** — core verification, browser smoke, CodeQL —
  is the price. The smoke is the expensive one at roughly three and a half
  minutes with a database and a browser.

## Verification that actually ran

- **The full suite locally, the way the workflow orders it**: local database
  reset and reseeded (`seed-local.ts --reset`, organization
  `local-dev-organization`), production build, `npx playwright test` — **18
  passed** in 33s across `chromium` and `mobile-chrome`. That is the same count
  CI reported on `ca1472d`.
- All five workflow files parse as YAML and expose the jobs they claim
  (`browser-smoke.yml` → `smoke`, `deploy-vercel.yml` → `validate`,
  `deploy-prod-manual`, `verify-core.yml` → `verify-core`).
- **Read back on the runner.** The owner pushed to `main` and four workflows ran
  at `4ad5977`, all green: `Browser smoke` `31880134622` in 2m26s with **18
  tests passed**, `Vercel Deployment & Pipeline Checks` `31880134585` in 2m37s,
  `Core verification` `31880134596` in 1m46s, `CodeQL` `31880134601` in 1m45s.
  The new workflow's steps ran in the order written — checkout, Node, `npm ci`,
  build, Chromium, smoke — and its report artifact step stayed skipped, as it
  should on a pass.
- **The deploy job no longer touches a browser**, checked step by step rather
  than inferred: job `95001443236` runs verify and the mutation dry run and has
  no `Install the smoke browser` and no Playwright step. It also came in at
  2m34s against 3m23s for the same job on the previous commit.

## Risks and things left

- **"Every branch" is still an inference, not a reading.** The push went to
  `main`, so what the runner has demonstrated is that the file is valid and
  green there. The trigger is `on: push` with no filter — byte for byte the
  shape `verify-core.yml` uses, and that one demonstrably runs on branches — so
  the next branch push is what turns this into evidence.
- `docs/local-environment.md` and the `shalomut-verification` skill describe the
  smoke by command (`npm run test:e2e`) and not by workflow file, so neither
  needed editing. If either starts naming workflows, this is the entry to
  re-read.

## Next concrete step

Nothing on this branch; it is closed and this file is archived. The one thing
left to observe costs nothing to observe: the first push of any branch should
show `Browser smoke` running on it.
