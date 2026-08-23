# The share code finds its own index — and stops being a pattern

## Metadata

- Branch: `perf/the-share-code-finds-its-own-index`
- Base branch: `main`
- Base commit: `9b9382b`
- Current HEAD: `96c2e52`, an ancestor of `main`. The branch is `dfdbddf`, `96c2e52`,
  oldest first.
- Status: complete, landed on `main`; archived 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

The branch name is what the task was picked up as. It turned out to understate
the work, and is left alone rather than renamed — the commits and this file say
what it actually is.

## Objective

Close the 2026-08-21 audit's «Публичный поиск по share-code не может
использовать свой уникальный индекс из-за `mode:'insensitive'`», anchored at
`prisma-round.repository.ts:121`.

## What was actually wrong

The audit filed this as a missed index. It is that, and it is also an access
defect on the product's only unauthenticated path.

`mode: 'insensitive'` with `equals` compiles to `ILIKE` on PostgreSQL, and
`ILIKE` reads `%` and `_` **in the value** as wildcards. So:

- `GET /api/survey/%` returns a school's round to somebody holding no code.
- So does `SHALOM-%`, and so does a run of `_` at the right length.
- A real code plus a trailing `%` could match a *different* round, and
  `findFirst` returned whichever came back first.

Confirmed over HTTP against a running server before the change, and again after:

```
%25            -> was: {"error":"Survey round is not active (status: closed)"}
                  now: {"error":"Survey round with code '%' not found"}
```

The 400 rather than a questionnaire is only because every round in the local
database is closed or draft. On a school with an active round it is the
questionnaire, and the `attempt`, `delivery` and `submit` routes resolve through
the same lookup.

`round.service.ts` describes the share code as "the only thing standing between a
stranger and a school's questionnaire". It was not standing there.

## Decisions made

1. **`findUnique` on an exact, normalized value.** The input is trimmed and
   upper-cased on our side, then compared for equality. Case had to stay
   forgiving — the code is read off a slide in a staff meeting and typed by hand
   — but forgiving it here rather than in the query is what removes the pattern
   semantics *and* lets the lookup use `survey_rounds_share_code_key`. One
   change, both halves of the finding.
2. **A migration normalizes stored codes.** `SHARE_CODE_ALPHABET` is uppercase,
   so every generated code already matches and the statement is expected to touch
   nothing; it exists for rows nobody generated — fixtures, seeds, anything typed
   in while the lookup forgave it. It **skips a row whose uppercase form another
   round already holds**, because `share_code` is unique and a migration that can
   fail halfway is worse than one that leaves a row alone and says so. Two rounds
   differing only in case were already broken: the old lookup was `findFirst` over
   an `ILIKE`.
3. **No shape validation at the route.** One mechanism that is exactly right
   beats two that each half-cover it, and a length-or-alphabet check would have
   to be kept in step with the generator forever.
4. **The fake Prisma client in `__tests__/prisma.test.ts` was updated, not
   patched around.** It folded case in `findFirst`, imitating the query the
   repository used to make. It now models `findUnique` on both of the table's
   unique keys. A double that keeps imitating a query nobody makes is how the
   next defect gets a passing test.
5. **The index claim is asserted comparatively, on 500 rows.** The first version
   of that test planned one query against a three-row table, got `Seq Scan`, and
   was right to fail: on three rows a scan really is cheaper, and the assertion
   was about the planner's arithmetic rather than the index. It now plans both
   the new query and the old one and asserts that the first reaches the index and
   the second cannot.

## Why nothing caught it

`InMemoryRoundRepository.findByShareCode` has always done
`shareCode.trim().toUpperCase()` and compared for equality. The two stores
disagreed, and the suite everybody runs exercises the one that was correct. That
is the argument for the `__dbtests__` directory existing, and the regression test
lives there.

## Changed files

- `src/lib/repositories/prisma/prisma-round.repository.ts` — the lookup.
- New `prisma/migrations/20260823160000_share_codes_are_stored_the_way_they_are_generated/migration.sql`.
- `src/lib/repositories/__tests__/prisma.test.ts` — the double.
- New `src/lib/repositories/__dbtests__/postgres-share-code-lookup.test.ts`.
- `PROJECT_CONTEXT.md` ADR-044, `docs/critical-audit-2026-08-21.md`,
  `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`.

## Exact Git state

See the commits on this branch. The only unstaged file is `next-env.d.ts`, which
is generated and belongs to the owner — stage with
`git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:db` — exit `0`, **79 tests, 79 pass**. Four are new: seven
  wildcard shapes each resolve to nothing; a real code still resolves however a
  person types it; equality plans an index scan where `ILIKE` plans a sequential
  one; and two rounds sharing a prefix each reach their own.
- `npm run verify:core` — exit `0`, zero `not ok`.
- **Over real HTTP, on the running dev server, before and after.** Before: `%`,
  `SHALOM-%` and seventeen underscores each resolved to a round. After: each
  answers `not found`, while `SHALOM-BREAKDOWN-1787319195780` and its lowercase
  form both still resolve.
- **The deployed database was read** before claiming the migration is a no-op
  there: 1 round, 0 codes not uppercase, 0 that would collide when uppercased.
  Read-only, over the product's verified TLS (`resolvePoolConfig`, ADR-040), with
  a throwaway script that was deleted.

### Blocked or not run

- **The deployment was not probed.** Reproducing this there means opening a real
  school's questionnaire without its code, which is the thing being fixed. The
  local reproduction plus identical code is the evidence; the deployment is
  assumed affected, not proved to be.
- `npm run test:e2e` — not run. No screen or redirect changed, and the respondent
  specs exercise real codes, which behave identically.
- The Python suite was not run: nothing on that side changed.

### Environment

Local. Owner's `next dev` on `:3000` (HMR picked the change up; the server was
not restarted), disposable PostgreSQL on `127.0.0.1:5433` via `verify:db`, and
one read-only query against the deployed Supabase database.

### Residual risk

- **Anything submitted through the hole is indistinguishable from a real
  submission.** There is no marker to search for and no counter that would have
  noticed. The deployed database holds one round; whether it collected anything
  this way cannot be answered from the data, only bounded by its response count.
- The `attempt` and `submit` routes were not separately re-probed after the fix.
  They resolve through the same `findByShareCode` and the db suite covers it, but
  the HTTP evidence above is for `GET /api/survey/{shareCode}` only.

## Next concrete step

Hand the owner the push, which is theirs to run — **and this one is worth doing
promptly rather than batching**:

```
git push origin perf/the-share-code-finds-its-own-index:main
```

The push applies the migration to the deployed database as part of the build; the
counts above are why that is expected to be uneventful.
