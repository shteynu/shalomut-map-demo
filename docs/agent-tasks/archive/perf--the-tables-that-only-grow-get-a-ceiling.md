# The tables that only grow get a ceiling

## Metadata

- Branch: `perf/the-tables-that-only-grow-get-a-ceiling`
- Base branch: `main`
- Base commit: `99a896c`
- Current HEAD: see **Exact Git state**
- Status: complete and verified
- Landed on `main` as `eb46b87`, pushed by the owner 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the 2026-08-21 audit's three unbounded-growth rows: `ai_analysis_runs`
counted by loading it, `audit_events` read whole, and a questionnaire with no
ceiling on the manager write path.

## What was wrong

Three rows, one shape: a read whose cost is the age of the platform, and a write
with nothing to stop it inflating one.

1. **Closing a round loaded its own history to count it.** The request key of
   the run a closing queues is derived from how many closings came before it, so
   that two requests racing on one close compute the same key and collapse on
   `@@unique([roundId, requestKey])`. That is one integer, and
   `enqueueAiAnalyticsOnClosure` obtained it by loading every run the round had
   ever had — each successful one carrying a whole Stone Map in `result` — and
   reading a length off the array.
2. **The audit log had one reader and it was unbounded.** `findMany` with no
   `take`, no cursor and no time bound, on a table that takes a row from every
   mutation of every school and is never pruned.
3. **`parseSurveyDefinition` had no size limit**, so a manager — or a script
   holding their session — could inflate every round row, every respondent
   payload and every paid prompt.

## Decisions made

1. **`countByTrigger` on the run repository.** The dispatch asks the database
   for the number. `findByRoundId` stays, because roughly fifteen test files
   read a round's whole history to assert on it against a store holding two or
   three rows, and rewriting them would buy nothing. Its doc comment now says no
   product path calls it and that a screen wanting this list needs a bounded read
   written for it.
2. **The audit log is paged now, while nothing renders it.**
   `getOrganizationAuditLogs` has no production caller today — which is the
   argument for bounding the read now rather than later. The alternative is a
   screen written against an unbounded call, shipped, and then discovered by
   whoever opens the log of the busiest school.
3. **The cursor carries an `id` as well as a `timestamp`.** `timestamp < last`
   steps over everything sharing that timestamp, and what shares one is two
   administrators acting at the same moment — the busiest instant in the log is
   the one a timestamp-only cursor drops.
4. **The clamp is one function, `auditLogPageSize`, not one per store.** Two
   clamps can disagree, and the one nobody runs tests against is the one behind
   the deployed screen.
5. **The in-memory store's order was wrong and was fixed with it.** It returned
   insertion order while PostgreSQL returned newest-first — the two stores
   disagreed about what the log is, and the durable one was the one no fast suite
   ran against.
6. **The questionnaire limits are opt-in, and one caller opts in.**
   `parseSurveyDefinition` is the read gate as much as the write gate: the round
   repository parses every stored definition back through it, and so do the
   public answer page, submission, analytics and result verification. A limit
   applied there would take a school's questionnaire off the wire over a row
   already stored — worse than the inflation it prevents. `enforceWriteLimits` is
   set only by the builder save, the one place a definition arrives from a
   browser. `POST /api/rounds` was checked and does not accept a client
   definition at all.
7. **Two limits, not one.** `MAXIMUM_SURVEY_QUESTIONS` (300) and
   `MAXIMUM_SURVEY_DEFINITION_BYTES` (512 KB): a count alone is passed by ten
   questions carrying a megabyte of text each. The size is measured on the value
   the parser rebuilds from its whitelist, so the number means the column and not
   the request body.
8. **No migration.** `[organizationId, timestamp]` on `audit_events` and
   `[roundId, queuedAt]` on `ai_analysis_runs` already exist and carry both new
   queries.
9. **Retention was deliberately not invented.** Nulling `result` on superseded
   runs, and whether audit rows are ever deleted, are questions about what the
   product keeps. Both audit rows say so and are marked closed only in part.

## Changed files

- `src/lib/repositories/interfaces.ts`, and both AI-run repositories —
  `countByTrigger`.
- `src/lib/server/trigger-ai-analytics.ts` — the dispatch.
- `src/lib/auth/domain-contract.ts` — `AuditLogPage`, `AuditLogCursor`,
  `auditLogPageSize`, `compareAuditEventsNewestFirst`, and the in-memory store.
- `src/lib/repositories/prisma/prisma-audit-log.repository.ts`,
  `src/lib/auth/manager-audit-service.ts`.
- `src/lib/survey-definition.ts`, `src/app/api/rounds/[roundId]/survey-definition/route.ts`.
- Tests: new `src/lib/auth/__tests__/an-audit-log-is-read-in-pages.test.ts` and
  `src/lib/repositories/__dbtests__/postgres-audit-log-pages.test.ts`; additions
  to `src/lib/__tests__/survey-definition.test.ts` and
  `src/lib/server/__tests__/trigger-ai-analytics.test.ts`; the fake Prisma client
  in `src/lib/repositories/__tests__/prisma-audit-log.repository.test.ts`.
- `PROJECT_CONTEXT.md` ADR-049, `docs/critical-audit-2026-08-21.md` (three rows
  plus the ledger, below), `PROGRESS.md`.

Nothing in `docs/openapi.yaml`: no endpoint changed shape. The builder save can
now answer `400` where it previously accepted, but the spec already documents a
`400` for a refused definition and does not enumerate reasons.

## The fake Prisma client had to be taught the new query

`prisma-audit-log.repository.test.ts` builds a small fake, and its `findMany`
read `orderBy?.timestamp === 'desc'`. The repository now sends an array, so the
fake silently stopped sorting and the "newest first" test failed — usefully.

It now asserts the ordering array and honours `take`, so a repository that
stopped ordering or stopped bounding fails here too. What it deliberately does
**not** interpret is the cursor's `OR`: reproducing a compound predicate in a
fake makes the test assert the fake's reading of it. That is asserted against
real PostgreSQL instead, and a cursor arriving at the fake is refused rather
than ignored.

## The audit's ledger was nineteen records out of date

Not part of the objective, found while marking the rows. The header said "31 of
50 open" and the narrative ledger's last entry said 29, while a count of the
`ЗАКРЫТА` marks on the records themselves gave 12 before this task and 9 after.
Every closure since 2026-08-23 morning marked its own record and left the ledger
alone.

The header now states 9 and says how it was counted. The ledger is marked as
abandoned rather than back-filled, and the entry names what is left: **three of
the nine are already fixed in code and merely unmarked** (the builder reporting
success on a failed activation; unconditional status transitions; machine
endpoints failing open with `VERCEL_ENV` unset), and one — the password door —
is superseded by the 2026-08-20 Google-identity decision. Five are genuinely
open. That is bookkeeping, and it was left as a named task rather than folded
into this one.

Also corrected: the membership record cited `adcfd21`, a hash that exists only
as a dangling object from before that branch was rebased. It is `ae3c6d1` on
`main`.

## Exact Git state

- `perf/the-tables-that-only-grow-get-a-ceiling`, branched from `origin/main`
  (`99a896c`), which now carries the previous two tasks.
- `66cc19d` — code and tests.
- The documentation commit follows it; see `git log`.

The only unstaged file is `next-env.d.ts`, which is generated and belongs to the
owner — stage with `git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, zero `not ok`, production build included.
- `npm run verify:db` — exit `0`, **93 tests, 93 pass** (88 before, 5 new).
- `npm run lint:doc-numbers` — exit `0`. The new constants are not registered
  with it, matching the precedent that `PROJECT_CONTEXT.md` states no claims.
- **Four regressions were planted and all four were caught**, after the tests
  were written and before they were trusted:
  - the write limits made unreachable → 2 parser tests fail;
  - the dispatch loading the history again → the counting test fails;
  - `take` removed from the durable read → 2 PostgreSQL tests fail;
  - the cursor reduced to `timestamp < last` → the shared-timestamp walk fails.
- The paging suites assert the two stores return the **same** page for the same
  events, walked with the same cursor, including four events sharing one
  timestamp.

### Blocked or not run

- **Nothing was walked over HTTP.** The builder save's `400` is asserted through
  the parser rather than through the route; the route change is one option
  literal.
- `npm run test:e2e` — not run. No screen, redirect or role gate changed, and
  nothing renders the audit log.
- **No `EXPLAIN` was taken.** Both queries use indexes that already existed and
  were measured when they were added; the claim here is that the read is
  bounded, which the tests assert directly.
- The Python suite — not run; nothing on that side changed.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433` for `verify:db`.

### Residual risk

- **A page limit is now a parameter, and a caller can ask for a big one.** It is
  clamped, and the clamp is asserted from both the shared function and the
  durable store — but the shape did not exist before and a future route that
  forwards a query parameter into it inherits whatever the clamp allows (200).
- **The questionnaire ceiling is enforced in exactly one place**, and nothing
  fails if a second write path forgets `enforceWriteLimits`. There is one such
  path today and it is the builder. A fitness check was considered and not
  written for a single call site.
- **`findByRoundId` still exists on the run repository** and still loads results.
  Its comment says who may call it; nothing enforces that.
- **Retention is untouched**, so both tables still grow without bound. What
  changed is that reading them no longer grows with them.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin perf/the-tables-that-only-grow-get-a-ceiling:main
```

Then the retention half needs an owner decision before it can be built: whether
`audit_events` rows are ever deleted, and whether a superseded run's `result` is
nulled once a newer successful run exists.
