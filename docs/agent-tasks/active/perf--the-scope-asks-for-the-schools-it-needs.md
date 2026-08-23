# A manager's scope stops reading the organizations table

## Metadata

- Branch: `perf/the-scope-asks-for-the-schools-it-needs`
- Base branch: `fix/the-counters-reach-a-place-that-can-warn-someone` (itself
  stacked on `fix/a-superseded-round-still-gets-its-analysis`, itself on `main`)
- Base commit: `524eac6`
- Current HEAD: the documentation commit at the tip of this branch
- Status: implemented and verified locally; nothing pushed
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the third finding the owner picked out of
`docs/critical-audit-2026-08-21.md`: *«Каждый запрос менеджера грузит всю
таблицу организаций, чтобы разрешить scope»*. Both authorization chokepoints —
every round API call and every manager screen — went through
`ManagerScopeService.resolveOrganizationId`, and it began with
`orgRepo.findAll()`.

## User-visible outcome

None, and that is the point. Every one of the fourteen behaviour tests in
`src/lib/services/__tests__/manager-scope.service.test.ts` passes unedited. What
changed is that a manager of one school no longer pays for every school in the
system on every authenticated request, and that the bill stops growing as
schools are onboarded.

## Context

The audit's anchor was `src/lib/services/manager-scope.service.ts:44` and its
suggested fix was «`findById` / `id IN (...)` вместо `findAll`». The read was
introduced when there was one school and one manager; phase 0 of the
multi-tenancy plan (2026-08-20) narrowed what the result was *used for* without
narrowing what was *read*.

## Scope

- `IOrganizationRepository` gains two bounded reads.
- `resolveOrganizationId` splits into its two real cases and uses them.
- `loadSchools` narrows the switcher in the query instead of in memory.
- Tests that count reads, and a PostgreSQL test that asks the planner.

## Non-goals

- `ManagerAdministrationService.loadOverview` and `scripts/inspect-ai-provenance.ts`
  keep calling `findAll`. «Every school» is genuinely their question, and the
  overview's own cost is already pinned by
  `an-administrator-overview-is-a-constant-number-of-queries.test.ts`.
- No index was added. The primary key is what a membership list is looked up by,
  and it already exists.
- No change to *which* school any request resolves to.

## Acceptance criteria

- `findAll` is not reachable from any branch of `resolveOrganizationId`.
- The fourteen existing behaviour tests pass without edits.
- The number and shape of repository calls does not change with the number of
  schools in the system.
- `verify:core` and `verify:db` pass.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, documentation lifecycle, the handoff
  protocol, and the rule that current code outranks prose.
- `.agents/skills/shalomut-verification/SKILL.md` — checks in proportion to the
  diff; this one touches a repository port and a hot path, so both suites ran.

## Relevant architecture and contracts

- ADR-008 — the composition root. Nothing here constructs a repository; the two
  new methods are used through the port.
- ADR-009/020 — the manager gate and the chosen school. Its paragraph in
  `PROJECT_CONTEXT.md` claimed the scope service reasons about the session's own
  schools; it now also asks for them, and the paragraph says so.
- `docs/multi-tenancy-plan-2026-08-20.md` §2 is a live plan whose diagnosis
  quotes both `findAll` calls. The diagnosis stands as written — it is why the
  boundary moved — and carries a dated note that the cost it describes is gone.

## Decisions made

- **Two methods, not one.** `findByIds(ids)` answers the session's question;
  `listIds(limit)` answers the sessionless one. A single `findAll(limit)` would
  have made every caller's question look the same when they are not.
- **The resolver splits on `memberOrganizationIds` rather than sharing a list.**
  The old body computed one population and then reasoned about it. The two cases
  ask the database different questions, so they read as two branches.
- **`listIds(2)`.** The decision uses at most two ids: one to land on, and a
  second only to know there was a choice. Both are then discarded.
- **`findByIds([])` asks nothing.** A session with no memberships must not cost
  a round trip to be told what its own header already said.
- **`toDomain` extracted in the Prisma adapter.** The row→domain mapping had
  four inline copies and would have had six. It is a mechanical extraction and
  is in the same commit as the methods that made it worth doing.
- **`loadSchools` converted too.** It is not the audit's named anchor, but it is
  the same read on the same class for the same reason, and its old comment
  defended filtering in the caller as a disclosure boundary — which asking for
  named ids keeps rather than loses.

## Assumptions

- Ordering: both new Prisma reads use `orderBy: { createdAt: 'desc' }`, the
  order `findAll` already answered in, so no caller sees a different first
  school. In the in-memory store both preserve insertion order, as `findAll`
  does. `listIds`'s order cannot change any of the three readings its caller
  makes of it, and is kept for the contract rather than for the caller.

## Completed

- `IOrganizationRepository`: `findByIds(ids)` and `listIds(limit)` declared,
  with the doc comment saying which callers `findAll` is left for.
- Both adapters implement them; the Prisma one via a single `toDomain`.
- `resolveOrganizationId` rewritten into its membership and no-membership
  branches. No `findAll` on either.
- `loadSchools` asks `findByIds` when the session has memberships and `findAll`
  only for a platform administrator, whose switcher genuinely lists every school.
- `src/lib/services/__tests__/the-scope-asks-for-the-schools-it-needs.test.ts` —
  seven tests that count calls, pin their arguments, prove the call list is
  identical against a system fifty times larger, and forbid `findAll` on every
  branch.
- `src/lib/repositories/__dbtests__/postgres-organization-scope.test.ts` — four
  tests: the two methods against real PostgreSQL, and the planner asked on five
  thousand rows whether the scope read uses the key.
- Documentation: the audit entry marked `ЗАКРЫТА` with its closure-log line
  (31 → 30 open), `PROJECT_CONTEXT.md`'s manager-gate paragraph, and the dated
  note in the live multi-tenancy plan.

## In progress

Nothing.

## Remaining

Nothing on this branch. The three stacked branches are all unpushed.

## Changed files

Modified:

- `src/lib/repositories/interfaces.ts`
- `src/lib/repositories/in-memory/in-memory-organization.repository.ts`
- `src/lib/repositories/prisma/prisma-organization.repository.ts`
- `src/lib/services/manager-scope.service.ts`
- `src/lib/server/manager-context.ts`
- `PROJECT_CONTEXT.md`
- `docs/critical-audit-2026-08-21.md`
- `docs/multi-tenancy-plan-2026-08-20.md`

Added:

- `src/lib/services/__tests__/the-scope-asks-for-the-schools-it-needs.test.ts`
- `src/lib/repositories/__dbtests__/postgres-organization-scope.test.ts`
- this file

`next-env.d.ts` is modified in the worktree and belongs to the owner; it is
excluded from every commit on this branch.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 1650 tests across 13 runs, 0 failures, plus
  every fitness gate (`lint:composition`, `lint:tenant-chokepoints`,
  `lint:doc-numbers`, `lint:fixtures`, `lint:skills`, `lint:contract-refusals`,
  and the rest), `typecheck`, `verify:ai`, `eslint` and `next build`.
- `npm run verify:db` — exit 0. 60 tests, 0 failures, including the four new
  ones. The planner test reports an index scan and no sequential scan on five
  thousand rows.
- `npx tsx --test src/lib/services/__tests__/manager-scope.service.test.ts` —
  14/14, file unedited. This is the acceptance criterion that matters most: the
  decision did not change, only its cost.

### Failed

None.

### Blocked or not run

- Nothing was checked on the deployed runtime. This branch is not pushed, and
  the change is invisible from outside — it produces the same answers.
- No measurement of wall-clock latency. The claim is about the number and size
  of reads, and both tests assert that directly rather than through a timer.

### Environment

Local only (`docs/local-environment.md`). `verify:db` used its own disposable
`shalomut_test` on `127.0.0.1:5433`; the deployed database was not touched.

### Residual risk

Low. The rewrite is behaviour-identical by construction and by the unedited
suite. The one place a difference could hide is ordering, and both new reads
answer in `findAll`'s order in both adapters.

## Failed approaches

None on this branch.

## Known risks

- `listIds` orders by `created_at`, which has no index. On the organizations
  table that is a top-2 sort of a few thousand rows at most, and only on the
  sessionless path. If that table ever grows to a size where the sort matters,
  the answer is an index and not a different contract.

## Approval gates

- `git push` is the owner's. Three branches are stacked and unpushed:
  `fix/a-superseded-round-still-gets-its-analysis`,
  `fix/the-counters-reach-a-place-that-can-warn-someone`, and this one.

## Questions requiring an owner decision

None.

## Next concrete step

Push the three stacked branches to `main`, oldest first, or say which of the
remaining audit findings to take next — the owner's list had a fourth: the round
reset's six sequential writes without a transaction, which races with an
in-flight submission.
