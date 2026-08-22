# The deploy applies its own migrations

## Metadata

- Branch: `fix/the-deploy-applies-its-own-migrations`
- Base branch: `fix/one-pool-per-process-and-one-index-per-lookup`, itself on
  `main`
- Base commit: `bb4163c`
- Landed as: `e1da436` and `342606c`, plus `b4f9b50`, all on `origin/main`,
  whose tip is `b4f9b50`
- Current HEAD: the commit carrying this file
- Status: **done and proved on the real deployment in both directions** —
  refusing without `DIRECT_URL`, migrating with it. No gate left.
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close high finding seven of the 2026-08-21 audit: no deploy path applied
migrations, so code raced a hand step every time the schema changed.

## User-visible outcome

None while things go well. When they do not, a schema change can no longer put
the product into the 500-per-read state it reached on 2026-08-04; the deployment
fails to build instead and the previous one keeps serving.

## Context

Three paths deploy this project and none of them migrated. `npm run build` ran
`prisma generate` and never `prisma migrate deploy`; the manual CI job ran
`vercel deploy --prod` with no migration step; and Vercel builds every push to
`main` on its own, which is how nearly every deployment actually happens. The
hand step that filled the gap ran for the last time earlier today, on this
branch's own parent.

## Scope

- `scripts/deploy-migrate.mjs` — the step, with the gate as a pure function.
- `scripts/check-deploy-migrations.mjs` — the fitness check that the step is
  still wired in, plus both test files.
- `package.json` — the build command and `lint:deploy-migrations` inside
  `verify:core`.
- `.github/workflows/deploy-vercel.yml` — a comment saying why this job has no
  migration step of its own.
- ADR-031 and the living documents that said migrations were a hand step.

## Non-goals

- The startup `migrate status` and maintenance mode the audit also suggests.
  That answers a different question — drift arriving some other way — and it
  touches `/api/health`, which UptimeRobot watches by keyword.
- A migration step in the CI job. Every path ends in a Vercel build, so a step
  there would cover this path twice and the git integration not at all.
- Anything about which migrations are safe to write. ADR-031 states the ordering
  rule the change introduces; enforcing it is not attempted.

## Acceptance criteria

- Every deployed build applies pending migrations before it builds.
- A build that cannot migrate fails rather than shipping.
- A local `npm run build` and a preview build migrate nothing.
- Dropping the step from the build command fails a check rather than passing
  silently.

## Relevant repository instructions

- `AGENTS.md`: obtain explicit bounded approval before changing credentials or
  authentication configuration. Setting `DIRECT_URL` on Vercel is the owner's,
  and it is named as a gate rather than done.
- `AGENTS.md`: when a living document disagrees with the code, update it in the
  same task. Three did — `PROGRESS.md`, the handoff and `local-environment.md`.

## Relevant architecture and contracts

- `prisma.config.ts` resolves `DIRECT_URL || DATABASE_URL`, so setting
  `DIRECT_URL` in the child environment is the whole of the wiring.
- Vercel sets `VERCEL_ENV` at build time; `shared-secret.ts` already relies on
  it being present on this deployment.
- The deployed `DATABASE_URL` is the transaction-mode pooler on `6543`, where
  the advisory lock `prisma migrate` takes does not survive. That is why a
  second variable is needed at all.

## Decisions made

- **In the build, not in CI.** Every path ends in a Vercel build; a CI job would
  cover the manual path twice and the automatic one never.
- **Fail closed when it cannot migrate.** The alternative to a failed build is
  not a working deployment — it is a deployment against a schema nobody
  migrated, which is the defect. A failed build ships nothing and the previous
  deployment keeps serving.
- **Keyed on `VERCEL_ENV === 'production'`, not on an opt-in of ours.** An
  opt-in variable is one more switch that can sit quietly in the off position,
  which is the shape of what is being closed. It also keeps `npm run build`
  inside `verify:core` from writing to any database.
- **Previews migrate nothing.** They share the one deployed database, and an
  unmerged branch has no business moving its schema.
- **The pooled connection string is refused by name.** `DATABASE_URL` copied
  into `DIRECT_URL` is the same database and the same credentials and differs
  only in port, so it looks correct; without the check the error a person meets
  is about an advisory lock rather than about a variable.
- **A fitness check, because the wiring is one string.** `package.json`'s build
  command is edited for unrelated reasons, and nothing about dropping the step
  from it would fail. `vercel-build` is checked too, since Vercel prefers it
  over `build` and adding one is a second way to bypass the step.

## Assumptions

- ~~`DIRECT_URL` is not currently set on the Vercel project.~~ **Confirmed on
  2026-08-22**, on the dashboard and by the failed build. Filtering the
  project's variables by `URL` returns `DATABASE_URL` and `AI_SERVICE_URL` and
  nothing else, both scoped Production and Preview. The owner then added it the
  same day, scoped Production *and* Preview — wider than needed and harmless,
  because a preview build skips the step on `VERCEL_ENV`.

## Completed

Everything in Scope.

## In progress

Nothing.

## Remaining

Nothing in the tree. One owner action before the push, under Next concrete step.

## Changed files

Added: `scripts/deploy-migrate.mjs`, `scripts/deploy-migrate.test.mjs`,
`scripts/check-deploy-migrations.mjs`,
`scripts/check-deploy-migrations.test.mjs`, this file.

Modified: `package.json`, `.github/workflows/deploy-vercel.yml`,
`PROJECT_CONTEXT.md`, `PROGRESS.md`, `docs/local-environment.md`,
`docs/shalomut-tracker-handoff.md`, `docs/critical-audit-2026-08-21.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- `npm run verify:core` unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1370 / # pass 1370 / # fail 0`, zero `not ok`. The log shows both new
  steps running: `lint:deploy-migrations` passing, and the build's own migrate
  step skipping because `VERCEL_ENV` is unset.
- **The four gate paths exercised as commands, not only as unit tests.** No
  `VERCEL_ENV`: skipped, exit 0. `VERCEL_ENV=production` with no `DIRECT_URL`:
  refused, exit 1, naming the variable. `VERCEL_ENV=production` with a `6543`
  string: refused, exit 1, naming the port. `VERCEL_ENV=production` with the
  local database: ran `prisma migrate deploy` for real, `No pending migrations
  to apply.`, exit 0 — which is what proves the spawn, the binary resolution and
  the environment passing, none of which a unit test touches.
- **Pending migrations really are applied through this path.** A scratch
  database `shalomut_migrate_probe` was created empty, migrated through
  `scripts/deploy-migrate.mjs` — 19 migrations applied, exit 0 — and its
  `question_answers` came out with exactly the two indexes the current schema
  has, including yesterday's drop. Then dropped.
- **A build that cannot migrate does not build.** `npm run build` with
  `VERCEL_ENV=production` and an unreachable database exits 1 with
  `P1001: Can't reach database server`, and `next build` never starts — zero
  occurrences of its banner in the log.
- **The fitness check proved against the real tree, three ways**, each restored
  from a copy afterwards: the step removed from `build`, a `vercel-build` script
  added that bypasses it, and the step moved after `next build`. Each produced
  exactly the matching failure.
- `npm run lint:doc-numbers` — exit 0 after the documentation edits.
- **The refusal happened on the real deployment, which is the first evidence
  that is not a simulation.** Vercel built `342606c` on the push and the
  deployment reads `Error`, `Command "npm run build" exited with 1`, duration
  **7s**. The build log carries the script's own sentence — `[deploy-migrate]
  refusing to build: DIRECT_URL is not set on this deployment…` — 132 ms after
  `npm run build` started, and neither `prisma generate` nor `next build` ran.
  The Production alias stayed on `bb4163c`, and `GET /api/health/` answers
  `commit: bb4163c`: a stopped pipeline, not a broken product, which is exactly
  the intended failure mode.
- **The migrating path then ran on Vercel too**, once the owner had added the
  variable and the failed deployment was redeployed. Build log: `[deploy-migrate]
  applying pending migrations before the build`, then `Datasource "db":
  PostgreSQL database "postgres" … at "aws-1-ap-northeast-2.pooler.supabase.com:
  5432"` — the direct port, which is what proves `DIRECT_URL` and not
  `DATABASE_URL` reached the child — then `19 migrations found in
  prisma/migrations` and `No pending migrations to apply.`, then `prisma
  generate` and `next build` as usual. Ready in **53 s**, Production, and
  `GET /api/health/` answered `commit: 342606c`, so the alias moved. `b4f9b50`
  had failed the same way while the variable was still missing and was redeployed
  after it, which is how the tip of `main` came to be serving again.

### Failed

None.

### Blocked or not run

Nothing. Adding `DIRECT_URL` was not done by this agent — it is a database
credential, and entering one is not something this agent does — but the owner
did it on 2026-08-22 and the success path then ran; see Passed.

### Environment

Local worktree, local PostgreSQL on `127.0.0.1:5433`, plus one scratch database
created and dropped on the same server. `GEMINI_API_KEY` was stripped from the
`verify:core` child environment.

### Residual risk

One, and it is the cost ADR-031 names rather than a defect: the schema now moves
ahead of the alias, so a destructive migration would break the deployment that is
still serving. ADR-031 states additive-first as a rule; nothing enforces it.

The stopped pipeline is no longer a risk — it lasted one afternoon and both
failed deployments were redeployed. What it taught is worth keeping, and is now
in the handoff: adding a variable rebuilds nothing, so every deployment that
failed on the missing gate has to be redeployed by hand.

## Failed approaches

None this time. The `git checkout` mistake from the previous task did not repeat
— every break-it-and-watch-it-fail pass here restored from a scratchpad copy.

## Known risks

`scripts/deploy-migrate.mjs` runs on every local `npm run build` and therefore
inside `verify:core`. It is a no-op there by design, and the unit test that pins
that no-op is the one to keep working: a regression that made it migrate would
mean a verification command writing to a developer's database.

## Approval gates

- ~~**`DIRECT_URL` on the Vercel project.**~~ Cleared 2026-08-22 by the owner.
  It was theirs to do, because it is a database credential and this agent may
  not enter one — asked to add it through the browser, this agent declined and
  supplied the value to the clipboard instead of printing it.

## Questions requiring an owner decision

None. Which audit finding comes next is a question, not a blocker.

## Next concrete step

None for this task — it is finished and this file is being archived. The owner
pushes the documentation commit that closes it, and the next task picks an entry
from `docs/critical-audit-2026-08-21.md`: 44 of 50 are open, six of them high.
