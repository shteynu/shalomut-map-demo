# An administrator overview is a constant number of queries

## Metadata

- Branch: `perf/an-administrator-overview-is-a-constant-number-of-queries`
- Base branch: `main`
- Base commit: `d2df517`
- Current HEAD: the commit carrying this file, on top of `e056d21`
- Status: code done, verified, **not pushed**
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the last high finding of the 2026-08-21 audit in the half it named as the
mechanism: `loadOverview` asked three queries per school inside a loop and timed
out the only administration screen at a few hundred schools.

## User-visible outcome

The administration console keeps answering as the platform grows. At a hundred
schools the screen was around 300 sequential round trips against a database some
180 ms away — roughly 54 seconds, past the function timeout.

## Context

ADR-029 accepted a cost "linear in the number of schools" and recorded it as
three queries per school. The three were awaited one after another inside a
`for` loop, and one of them read every round of the school with its whole
questionnaire.

## Scope

- `src/lib/auth/manager-administration-service.ts` — `loadOverview`.
- `src/lib/auth/domain-contract.ts` and `prisma-manager.repository.ts` —
  `findMembershipsByOrganizationIds`.
- `src/lib/repositories/interfaces.ts`, both round repositories —
  `findSummariesByOrganizationIds` and `SurveyRoundSummary`.
- Both survey repositories — `countResponsesByRoundIds`.
- `prisma-client.ts` — `groupBy` on the minimal surface.
- `prisma/schema.prisma` and migration
  `20260822193000_a_school_finds_its_rounds_without_a_scan`.

## Non-goals

- **Pagination and server-side search in the console.** The audit's second
  sentence, and left open deliberately: how many schools to a page and what
  searching them means is a product decision. Recorded in ADR-036, in the audit
  entry and in the handoff as an owner question.
- Anything about what the screen shows. ADR-029's k-anonymity limit — no figure
  computed across schools — is untouched, and its tests still pin it.

## Acceptance criteria

- The number of repository calls is identical for one school and for
  twenty-five.
- None of the three per-school reads is made by this screen.
- The round summary query names six scalar columns and no questionnaire.
- Everything ADR-029's tests assert about the screen still holds.

## Relevant repository instructions

- `AGENTS.md`: verify in proportion to risk. A read path on an authenticated
  screen, so mutations plus the PostgreSQL suite.
- `AGENTS.md`: current code outranks prose — ADR-029's cost paragraph now points
  at its successor rather than being rewritten.

## Relevant architecture and contracts

- ADR-029: an administrator reads each school and never the schools together.
  Its cost paragraph is superseded here; its privacy limit is not.
- ADR-036, added by this task.

## Decisions made

- **The set-based reads take ids, not "everything".** The console renders every
  school today, so both are the same query — but the day it pages its list, the
  page is what these methods are asked about.
- **A round with no responses is absent from the grouped count.** That is what
  `GROUP BY` says; the caller reads `?? 0` rather than the repository inventing
  zeroes.
- **The index was decided by the planner, not by the finding.** The audit called
  `organization_id` unscannable. Measured at 5 000 rounds: the overview's own
  query is a sequential scan with or without an index, because it wants every
  row. The index is in this change for the per-school read every manager screen
  makes — 0.50 ms to 0.034 ms — and the ADR says so rather than implying the
  screen needed it.

## Assumptions

- The console renders the whole list, so reading every membership and every
  round summary is the same work the loop was doing, minus the round trips.
  Pagination would change that, and the id-taking methods are already shaped for
  it.

## Completed

Everything in Scope, plus ADR-036, `PROGRESS.md`, the handoff and the audit
file.

## In progress

Nothing.

## Remaining

Pagination and server-side search — an owner decision, recorded, not started.

## Changed files

Added:
`src/lib/auth/__tests__/an-administrator-overview-is-a-constant-number-of-queries.test.ts`,
`src/lib/repositories/__tests__/a-summary-read-asks-for-six-columns.test.ts`,
`src/lib/repositories/__dbtests__/postgres-administration-overview.test.ts`,
`prisma/migrations/20260822193000_a_school_finds_its_rounds_without_a_scan/migration.sql`,
this file.

Modified: `manager-administration-service.ts`, `domain-contract.ts`,
`prisma-manager.repository.ts`, `interfaces.ts`, both round repositories, both
survey repositories, `prisma-client.ts`, `prisma/schema.prisma`,
`src/lib/types/backend.ts`, `src/lib/repositories/__tests__/prisma.test.ts`,
`PROJECT_CONTEXT.md`, `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`,
`docs/critical-audit-2026-08-21.md`.

Moved: the previous task file into `docs/agent-tasks/archive/`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- `npm run verify:core` unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1413 / # pass 1413 / # fail 0`, zero `not ok`, the Python suite green
  inside `verify:ai`, and the build compiled.
- `npm run verify:db` against real PostgreSQL: `REAL_EXIT=0`, 47 of 47,
  including the four added here and the new migration applied by the run.
- **Seven mutation passes**, each restored from a scratchpad copy:
  1. a per-school membership read added back → all three call-count tests fail;
  2. a per-school rounds read added back → the same three fail;
  3. a per-school response count added back → the same three fail;
  4. the `select` removed from the summary query → the projection test fails;
  5. the empty-id guard removed → its test fails;
  6. the summary query's `where` removed → the PostgreSQL scoping test fails;
  7. (in the earlier form of 1 and 2) rewriting the loop back in place failed to
     compile, which is recorded below rather than counted as a catch.
- **The index decision is a measurement, not an argument.** 500 schools × 10
  rounds with real questionnaires, 5.7 MB: one school's rounds 0.50 ms
  sequential against 0.034 ms indexed; the overview's `IN` query 0.88 ms
  sequential either way, the planner declining the index in both runs.

### Failed

- **The first two mutations proved nothing.** Reintroducing the loop broke
  compilation, so the tests failed for the wrong reason. They were rewritten as
  an extra per-school read inside a compiling function, which the call-count
  tests then caught.
- **The `select` mutation initially survived.** The PostgreSQL test asserted the
  shape the repository returns, and the repository maps rows into a summary
  whether or not the query projected them — a query that read every
  questionnaire would have looked identical. The projection is now read from the
  query itself.

### Blocked or not run

- No browser walk of `/admin`. It is behind `/login` and behind the
  administrator gate; the screen's content is pinned by the ADR-029 tests, which
  still pass, and what changed is the number of queries behind it.
- No measurement against the deployed database. The round trips it would count
  are the ones removed, and the local planner answered the only question that
  needed a real engine.

### Environment

Local worktree; local PostgreSQL on `127.0.0.1:5433` for `verify:db` and for the
planner measurement. `GEMINI_API_KEY` was not needed and no provider call was
made.

### Residual risk

The console still renders every school, so the two full-table reads ADR-029
already had — every school, every manager — remain, and so do the two new
whole-set reads. They are five queries rather than 3N round trips, but they are
not bounded by a page. Pagination is what bounds them, and it is the open half
of this audit entry.

## Failed approaches

Both recorded above under Failed: a mutation that failed to compile rather than
to assert, and a test that watched the wrong end of a query.

## Known risks

`SurveyRoundSummary` is a second shape for a round. Nothing forces a new field
onto it, which is the point — but a screen that later needs one more column has
to add it here rather than reach for `SurveyRound` and quietly bring the
questionnaire back.

## Approval gates

None. No credentials, secrets, aliases or authentication configuration were
touched. The migration adds one index and a deployed build applies it (ADR-031).

## Questions requiring an owner decision

**Pagination and server-side search in the administration console** — the open
half of this entry. How many schools to a page, and whether search is by name,
city or person, is a product call.

## Next concrete step

The owner pushes `perf/an-administrator-overview-is-a-constant-number-of-queries`
to `main`; the deployed build applies the index migration. After that, archive
this file and decide with the owner whether pagination is worth a slice now.
