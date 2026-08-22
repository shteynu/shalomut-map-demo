# A round computes its analytics once

## Metadata

- Branch: `perf/a-round-computes-its-analytics-once`
- Base branch: `main`
- Base commit: `db6061b`
- Current HEAD: the commit carrying this file, on top of `5927444`
- Status: code done, verified, **not pushed**
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the oldest high finding of the 2026-08-21 audit: a round's analytics were
derived from every one of its response rows on every manager screen, every
dashboard comparison and every AI request.

## User-visible outcome

The manager screens of a school with a real staff list stop waiting on tens of
thousands of rows to display numbers that had not changed. At 300 staff on the
126-question instrument one page view aggregated some 38 000 answer rows in
Node; the dashboard did it up to five times.

## Context

`getAnalyticsForRound` called `findResponsesByRoundId`, which selects every
`SurveyResponse` of the round with all its `QuestionAnswer` rows and no
`take`/`select`, and aggregated them in process. There was no stored aggregate,
no cache and no SQL aggregation. Two facts the code already held make most of
that work unnecessary: a round that is still collecting publishes nothing
(ADR-030), and a round that has stopped collecting cannot change.

## Scope

- `src/lib/services/analytics.service.ts` — `readRoundQuestionnaire`,
  `lockedRoundAnalytics`, `stillTheSameBasis`, and the three-path
  `getAnalyticsForRound`.
- `src/lib/analytics/published-analytics.ts` — the codec for the column.
- `prisma/schema.prisma` and migration
  `20260822180000_a_closed_round_keeps_the_numbers_it_published`.
- `src/lib/repositories/interfaces.ts` and both round repositories — find, save
  and clear.
- `src/app/api/rounds/[roundId]/reset/route.ts` — clears it.
- `src/lib/server/ai-insights-service.ts` — the callback verifier reads through
  the same path instead of recomputing.
- `scripts/verify-db.mjs` — the PostgreSQL suites are read from the directory
  rather than listed by hand.

## Non-goals

- SQL `GROUP BY` aggregation, the audit's third suggestion. Scales, polarity
  and the colour-vs-Likert bucketing live in `readAnalyticAnswers` and
  `bucketForAnswer`; a second copy of that arithmetic in SQL would be a
  divergence waiting to happen, and the two cheap measures remove the repeated
  work anyway.
- The two screens that still read every response once: the demographic
  breakdown, which partitions the responses themselves, and the filling report,
  which needs per-respondent timing.
- Writing the analytics at close time. The lazy fill covers rounds that closed
  before this shipped and is one code path instead of two.

## Acceptance criteria

- A round that is still collecting reads no answer rows.
- The short-circuited locked payload is identical to the full calculation's.
- A round that has stopped collecting derives its numbers once.
- A changed count, questionnaire or privacy threshold is not answered from the
  stored copy, and a reset clears it.
- The school context comes from the round, never from the copy.

## Relevant repository instructions

- `AGENTS.md`: verify in proportion to risk. This changes what every manager
  screen reads, so both the mutation passes and the PostgreSQL suite were run.
- `AGENTS.md`: current code outranks prose — `PROGRESS.md`, the handoff and the
  audit entry all described the old behaviour.

## Relevant architecture and contracts

- ADR-030: one basis of calculation per round. It is the whole argument for
  both halves: a collecting round publishes nothing, and a closed one publishes
  once.
- ADR-032: a required parameter beats an optional one that will be left out —
  the reason the three methods sit on `IRoundRepository`.
- ADR-035, added by this task.

## Decisions made

- **The stored copy is validated against the round's basis, not trusted.** Same
  round, same school, same count, same threshold, same measurement snapshot
  hash.
- **The measurement hash alone, not both hashes.** It is computed from the same
  questions plus `scaleId` and `polarity`, so it moves whenever
  `surveyDefinitionHash` does. A test pins that relation.
- **The school context is not stored.** It is the round's and stays editable
  after the round closed; two homes for one fact is how a copy goes stale.
- **The verifier reads through the same path.** Verifying an AI payload against
  a second calculation of the round is the expensive way to ask and the way to
  disagree with ourselves.
- **`verify:db` reads its suite directory.** The hand-written list silently
  skipped the new suite — the first run reported 39 green tests without running
  any of the four added here.

## Assumptions

- A closed round's responses do not change except through reset, which clears
  the copy. Any other change still moves the count and so fails the basis check.

## Completed

Everything in Scope, plus ADR-035, `PROGRESS.md`, the handoff and the audit
file.

## In progress

Nothing.

## Remaining

Nothing in the tree. The push is the owner's.

## Changed files

Added: `src/lib/analytics/published-analytics.ts`,
`src/lib/analytics/__tests__/published-analytics.test.ts`,
`src/lib/services/__tests__/a-round-computes-its-analytics-once.test.ts`,
`src/lib/repositories/__dbtests__/postgres-published-analytics.test.ts`,
`prisma/migrations/20260822180000_a_closed_round_keeps_the_numbers_it_published/migration.sql`,
this file.

Modified: `analytics.service.ts`, `interfaces.ts`, both round repositories, the
reset route, `ai-insights-service.ts`, `scripts/verify-db.mjs`,
`prisma/schema.prisma`, `src/app/api/__tests__/api.test.ts`,
`PROJECT_CONTEXT.md`, `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`,
`docs/critical-audit-2026-08-21.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- `npm run verify:core` unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1408 / # pass 1408 / # fail 0`, zero `not ok`, the Python suite green
  inside `verify:ai`, and the build compiled.
- `npm run verify:db` against real PostgreSQL: `REAL_EXIT=0`, 43 of 43,
  including the four added here — the column round-trips a `Date`, a cleared
  round holds SQL `NULL` rather than the string "null", and a write for a round
  that no longer exists does not fail the read it happens on.
- **Ten mutation passes**, each restored from a scratchpad copy:
  1. the collecting short-circuit removed → its test and the end-to-end
     unlocking test fail;
  2. the basis never checked → the count and questionnaire tests fail;
  3. the count dropped from the basis → the count test fails;
  4. the measurement hash dropped from the basis → the questionnaire test fails;
  5. nothing stored after computing → the once-only test fails;
  6. the stored school context served instead of the round's → three tests fail,
     including the MCP payload's context case;
  7. the reset's clear removed → the reset route test fails;
  8. the privacy threshold dropped from the basis → its test fails;
  9. the format marker ignored on decode → the codec test fails;
  10. `calculatedAt` stored as an object rather than an ISO string → two
      service tests fail, because the in-memory repository holds the encoded
      form exactly as the column does.

### Failed

- **Two mutations initially caught nothing, and both changed the code.**
  Dropping `surveyDefinitionHash` from the basis check left every test green:
  `createMeasurementSnapshotHash` projects the same questions plus two more
  fields, so the clause was unreachable. It was removed and the relation the
  remaining check depends on is now pinned by its own test. Dropping the
  privacy threshold also left every test green — nothing covered a threshold
  raised after publication, which would have kept showing numbers that the new
  threshold locks. That test now exists.
- **The first `verify:db` run reported 39 green tests without running the new
  suite.** `scripts/verify-db.mjs` listed its files by hand. It now reads the
  directory and fails if it finds none.

### Blocked or not run

- No browser walk and no measurement against a populated database. The change
  is about how many rows are read, and the tests count the reads directly; a
  timing on a seeded local database would measure the seed.

### Environment

Local worktree; local PostgreSQL on `127.0.0.1:5433` for `verify:db`.
`GEMINI_API_KEY` was not needed and no provider call was made.

### Residual risk

The stored copy is a second home for numbers that are also derivable. Its guard
is the basis check, and everything that can change a round's numbers moves one
of the fields it compares — but a future field that changes what the
calculation produces without moving the count, the threshold or the measurement
hash would be served stale. ADR-035 names the check so that the next such field
has somewhere to be added.

## Failed approaches

Both recorded above under Failed: a clause no test could reach, and a green
`verify:db` that had run none of the new tests.

## Known risks

`stillTheSameBasis` is the only thing standing between a stored copy and a
manager's screen. It is small on purpose and every clause of it now has a test
that fails when the clause is removed.

## Approval gates

None. No credentials, secrets, aliases or authentication configuration were
touched. The migration is additive and nullable, and a deployed build applies it
on its own (ADR-031).

## Questions requiring an owner decision

None. 39 audit entries remain open, one of them high: the administrator
overview's N+1.

## Next concrete step

The owner pushes `perf/a-round-computes-its-analytics-once` to `main`. The first
deployed build adds the `published_analytics` column as part of its own migrate
step. After that, archive this file and take the next audit entry.
