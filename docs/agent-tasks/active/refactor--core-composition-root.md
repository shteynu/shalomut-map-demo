# Core composition root instead of `getRepositories()`

## Metadata

- Branch: `refactor/core-composition-root`
- Base branch: `main`
- Base commit: `44982f0`
- Current HEAD: `44982f0`
- Status: in progress
- Last updated: 2026-08-03
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Replace the Core service locator `getRepositories()` with a single composition
root: one module decides Prisma-vs-ephemeral wiring and constructs every
repository, entrypoints resolve once at their own edge, and nothing below an
entrypoint reaches into a module for a dependency.

## User-visible outcome

None. Runtime behaviour, wire payloads and persistence semantics stay identical;
this is the last structural slice of stage 4 of the refactoring plan.

## Context

- `docs/wellbeing-refactoring-plan-v4-review.md` §6, stage 4: the only remaining
  "Нет" is `composition root вместо getRepositories() в Core`, named there as the
  largest independent remaining slice and the last place where a dependency is
  taken from a module instead of a constructor.
- Python already has this shape: `AnalyticsSource`, `ResultSink`, `JobStore`,
  `TextGenerator` as ports with constructor injection and a default composition
  at the module boundary (`6fefc9c`, `612b4fb`).
- Core services already take repositories as parameters
  (`ManagerContextService.load(orgRepo, ...)`, `applyAiInsightsCallback(...,
  repositories)`). What is left is the entry edge: 15 files call
  `getRepositories()` from `@/lib/repositories`.

## Scope

- New `src/lib/composition-root.ts`: `CoreRepositories` type, Prisma and
  ephemeral factories, `resolveCoreRepositories()`, test/script override seam.
- `src/lib/repositories/index.ts` returns to being a catalogue: interfaces,
  implementations and demo fixtures, no construction, no `globalThis` state.
- Update every entrypoint (14 route files, `answer/[shareCode]/page.tsx`,
  `src/lib/server/manager-context.ts`) to resolve once at the top of the handler
  and pass the result down.
- Update tests and `scripts/local-unlocked-pipeline.ts` to the new seam.
- Add a fitness check (`scripts/check-composition-root.mjs`, mirroring
  `check-version-literals.mjs`) so the boundary cannot silently erode, wired into
  `npm run verify:core`.
- Update the documents that name this slice as open.

## Non-goals

- `src/lib/server/manager-audit.ts` keeps its process-local
  `InMemoryAuditLogRepository` singleton. It is documented as deliberate and
  migration-gated (a durable audit table is a separate slice), and it is not the
  repository locator this task removes.
- No repository interface, persistence or contract change. No migration.
- Stage 5 items (`DashboardInsightsDto`, `demo-data.ts` production types,
  identity) stay out.

## Acceptance criteria

- `getRepositories` no longer exists in `src/`.
- Only allowlisted entrypoints import the composition root; the fitness check
  fails when a new file below an entrypoint imports it.
- Repository construction happens in exactly one production module.
- `npm run verify:core` passes; existing route/repository tests pass unchanged in
  intent (only the seam's name and import path change).

## Relevant repository instructions

- `AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md` (canonical boundaries),
  `.agents/skills/shalomut-verification/SKILL.md` (repositories + API rows).

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md` ADR-008 states the current position and names this slice
  as next; it has to be rewritten when the slice lands.
- Empty persistence must stay empty: the ephemeral fallback must not become a
  hidden data source, and `getPrismaClient()` still throws when `DATABASE_URL` is
  configured but the client cannot initialize.

## Decisions made

- Server components keep `loadManagerContext()` as their composition edge rather
  than resolving in each of the eight pages; it is allowlisted explicitly.

## Assumptions

- Route handlers stay directly callable from tests, so the composition root keeps
  an override seam. The difference from today is that the seam belongs to the
  wiring module, not to the repository catalogue.

## Completed

- Branch created, state audited, plan recorded.

## In progress

- Composition root module and call-site migration.

## Remaining

- Fitness check, documentation updates, verification.

## Changed files

- None committed yet.

## Verification evidence

### Passed

- None yet.

### Failed

- None.

### Blocked or not run

- Everything; implementation has not started.

### Environment

- local.

### Residual risk

- Not yet assessed.

## Failed approaches

- None.

## Known risks

- Next.js compiles route handlers and RSC into separate module graphs; the
  ephemeral fallback lives on `globalThis` for that reason. Moving it must keep
  that property or local development loses shared state between the two graphs.

## Approval gates

- None. No secrets, credentials, auth configuration or deployment alias is
  touched.

## Questions requiring an owner decision

- None.

## Next concrete step

Write `src/lib/composition-root.ts` and move construction out of
`src/lib/repositories/index.ts`.
