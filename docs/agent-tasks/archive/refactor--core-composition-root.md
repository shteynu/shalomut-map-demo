# Core composition root instead of `getRepositories()`

## Metadata

- Branch: `refactor/core-composition-root`
- Base branch: `main`
- Base commit: `44982f0`
- Current HEAD: this documentation commit, directly on top of `4802b22`
- Status: closed; merged into `main` on 2026-08-03
- Last updated: 2026-08-03
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Replace the Core service locator `getRepositories()` with a single composition
root: one module decides Prisma-vs-ephemeral wiring and constructs every
repository, entrypoints resolve once at their own edge, and nothing below an
entrypoint reaches into a module for a dependency.

## User-visible outcome

None. Runtime behaviour, wire payloads and persistence semantics are unchanged;
this closes the last structural item of stage 4 of the refactoring plan.

## Context

- `docs/wellbeing-refactoring-plan-v4-review.md` §6 stage 4 named this the
  largest independent remaining slice and the last place where a dependency was
  taken from a module instead of a constructor.
- Python reached this shape earlier: ports plus constructor injection with a
  default composition at the module boundary (`6fefc9c`, `612b4fb`).
- Core services already took repositories as parameters. Only the entry edge —
  14 route files, one RSC page and `src/lib/server/manager-context.ts` — still
  pulled them from `@/lib/repositories`.

## Scope

Delivered as described in `Completed`.

## Non-goals

- `src/lib/server/manager-audit.ts` keeps its process-local
  `InMemoryAuditLogRepository`; it waits on a durable audit table and is the one
  named exception in the fitness check.
- No repository interface, persistence, contract or migration change.
- Stage 5 items (`DashboardInsightsDto`, `demo-data.ts` production types,
  identity) stay out.

## Acceptance criteria

All met:

- `getRepositories` no longer exists anywhere in `src/`.
- Repository construction happens in exactly one production module.
- The fitness check fails on a non-entrypoint resolving the wiring and on a
  repository constructed outside the root; both cases are covered by its tests.
- `npm run verify:core` and `npm run verify:db` pass.

## Relevant repository instructions

- `AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
  `.agents/skills/shalomut-verification/SKILL.md` (repositories and API rows).

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md` ADR-008 now records the delivered shape.
- Empty persistence stays empty: the ephemeral set is still built empty, demo
  fixtures are not seeded into it, and `getPrismaClient()` still throws when
  `DATABASE_URL` is configured but the client cannot initialize.

## Decisions made

- Server components keep `loadManagerContext()` as their composition edge rather
  than resolving in each of the eight manager pages; the fitness check
  allowlists that one file by name with the reason.
- `resolveCoreRepositories()` takes an optional client, defaulting to
  `getPrismaClient()`. It mirrors the seam `getPrismaClient(createClient?)`
  already carries and lets the durable branch be tested without a database.
  Entrypoints call it with no arguments.
- The test seam stays, renamed to `overrideCoreRepositories` /
  `resetCoreRepositories` and moved to the composition root. Route handlers are
  invoked directly in tests, so there is no argument to pass them through.

## Assumptions

- None outstanding.

## Completed

- `src/lib/composition-root.ts`: `CoreRepositories`, `createPersistentRepositories`,
  `createEphemeralRepositories`, `resolveCoreRepositories`,
  `overrideCoreRepositories`, `resetCoreRepositories`.
- `src/lib/repositories/index.ts` reduced to the catalogue plus demo fixtures;
  the `globalThis` state and all construction moved to the composition root.
- 16 entrypoints migrated to `resolveCoreRepositories()`.
- Seven test files and `scripts/local-unlocked-pipeline.ts` migrated to the new
  seam; the three wiring tests moved out of `repositories.test.ts` into
  `src/lib/__tests__/composition-root.test.ts`, which also covers the durable
  branch, reset behaviour and factory isolation.
- `scripts/check-composition-root.mjs` plus `check-composition-root.test.mjs`,
  wired as `npm run lint:composition` inside `verify:core`.
- Documentation updated: `PROJECT_CONTEXT.md` ADR-008, `PROGRESS.md`,
  `ROADMAP.md`, `docs/ai-analytics-handoff.md`,
  `docs/shalomut-tracker-handoff.md`, `docs/wellbeing-refactoring-plan-v4-review.md`
  §6 and the `shalomut-map` skill boundary.

## In progress

- Nothing.

## Remaining

- Owner action: push `refactor/core-composition-root` and merge into `main`.

## Changed files

Commit `4802b22` (39 files: composition root, entrypoints, tests, fitness check,
documentation). The commit on top of it adds the review's `Чем закрыто` row and
this task file; that row names `4802b22`, which is the hash that matters.

## Verification evidence

### Passed

- `npm run lint:composition` — fitness check and its 5 tests, exit 0.
- `npm run lint:literals` — exit 0.
- `npm test` — 355 tests, 0 failures.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.
- `npm run build` — exit 0, all routes compiled.
- `npm run verify:db` — 7 PostgreSQL integration tests, 0 failures, against the
  local disposable test database on port 5433.

### Failed

- None.

### Blocked or not run

- `npm run verify:ai` (Python suite): not run. The diff contains no Python and
  no contract change, so the verification matrix does not require it.
- No browser smoke: no user-visible behaviour changed.

### Environment

- local.

### Residual risk

- Low. The change is structural and covered by the route, repository and
  PostgreSQL suites, which were not rewritten — only the seam's name and import
  path changed in them. The one behavioural subtlety is that
  `resolveCoreRepositories()` returns a snapshot copy of the ephemeral set, the
  same as `getRepositories()` did; a caller holding the object across an
  `overrideCoreRepositories()` call sees the old doubles, which no test does.

## Failed approaches

- None.

## Known risks

- The ephemeral fallback must stay on `globalThis`: Next.js compiles route
  handlers and RSC into separate module graphs, and local development depends on
  both graphs seeing one state. It was moved with that property intact.

## Approval gates

- None. No secrets, credentials, authentication configuration or deployment
  alias touched.

## Questions requiring an owner decision

- None.

## Next concrete step

Hand the branch to the owner to push
(`git push -u origin refactor/core-composition-root`) and merge into `main`.
Visibility today: both commits exist only on this branch in this worktree and
have not been pushed, so another worktree on this machine can consume them from
the branch, and no other checkout or machine can.
