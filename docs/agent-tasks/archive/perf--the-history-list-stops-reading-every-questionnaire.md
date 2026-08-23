# The history list stops reading every questionnaire

## Metadata

- Branch: `perf/the-history-list-stops-reading-every-questionnaire`
- Base branch: `main`
- Base commit: `36b9fd0`
- Current HEAD: `7b2d93c`, an ancestor of `main`. The branch is `558b4b3`, `7b2d93c`,
  oldest first.
- Status: complete, landed on `main`; archived 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the 2026-08-21 audit's «История версий тянет все 20 полных определений
анкеты, чтобы отрисовать даты», anchored at
`prisma-survey-definition-version.repository.ts:54`.

## What was actually wrong, and what the audit had backwards

The audit proposed `select: { id, roundId, savedAt }`. **That fix does not
work.** A history line shows four values — when the version was saved, its
title, how many questions it had, how many were enabled — and three of them live
*inside* the `definition` `jsonb` column. No `select` reaches them.

The route's own comment already said summaries rather than definitions, and it
was true of the response and not of the query: `findByRoundId` read every
version whole and `toVersionSummaries` discarded the definitions here.

**The audit also had the direction of the cost wrong**, and this is the part
worth carrying forward. Measured rather than assumed:

| per version | old read | new read | old result | new result |
| --- | --- | --- | --- | --- |
| 24 questions (today) | 2.6 ms | 1.6 ms | 132 KB | 2.4 KB |
| 126 questions (the coming default) | 7.0 ms | 3.4 ms | 640 KB | 2.4 KB |

Twenty versions, local disposable PostgreSQL, warm, forty runs averaged, three
trials each — the ratio held at 1.6× and ~2.0× across trials.

The new query makes the **database** do more work, not less: `EXPLAIN (ANALYZE,
BUFFERS)` shows the plain read touching 1–2 shared buffers and the summary
touching 121–163, because `jsonb_array_elements` expands every question of every
version. It wins on total time because serialising twenty definitions and
shipping them dominates. On the deployed link that term is much larger than it
is here, so the local figure is a floor.

Also worth recording: at 126 questions a stored definition is 7.6 KB of jsonb
(31.8 KB of raw JSON, compressed well), so this is **not** a TOAST story. The
rows sit in the main heap either way. The saving is the wire and the parse.

## Decisions made

1. **`findSummariesByRoundId` on the repository interface**, following the
   `findSummariesByOrganizationIds` precedent set for the administrator console.
   `findByRoundId` stays — it now has no production caller, and the interface
   says so and says when to reach for it — because it is what the durable
   store's result is checked against.
2. **Hand-written SQL, and it is the only such read in the product.** The
   alternative was storing the counts at write time, which the summariser's own
   comment already refused: the numbers should describe the definition as it is
   read back, not as it was counted. That decision was not mine to reverse
   inside a performance fix.
3. **`jsonb_array_elements` over `jsonb_path_query_array`.** Both were measured;
   the jsonpath form was slower at both sizes (2.3 ms against 1.6 ms at 24
   questions, 4.2 against 3.2 at 126).
4. **`MinimalPrismaClient` exposes `$queryRaw`, tagged-template form only.**
   `$queryRawUnsafe` takes a string, and a repository that can build SQL from a
   string is a repository somebody will eventually build one from a request
   with. Optional like `$transaction`, with the repository throwing a sentence
   that names what is missing.
5. **`isCurrent` left the store.** It is a fact about position in an ordered
   list, not about a row, so `summariseVersion` produces rows and
   `markCurrentVersion` marks the first. The argument for *why* the newest row is
   the one in force — a version is written after the round updates, never before
   — stays with the marking.
6. **`count(*)` is cast to `int` in SQL.** A `bigint` arrives as a JavaScript
   `BigInt`, which `JSON.stringify` refuses; the route would have answered 500.
7. **The tagged template is taken off `this.prisma`, not off a local.** Prisma's
   `$queryRaw` reaches for its client through its own `this`; a detached
   reference fails deep in the runtime with a message about
   `_createPrismaPromise` and nothing about the call site. Found by running it.

## Changed files

- `src/lib/repositories/interfaces.ts` — the new method and what it is for.
- `src/lib/repositories/prisma/prisma-survey-definition-version.repository.ts` —
  the SQL.
- `src/lib/repositories/prisma/prisma-client.ts` — `$queryRaw`.
- `src/lib/repositories/in-memory/in-memory-survey-definition-version.repository.ts`
  — the same answer from the objects it already holds.
- `src/lib/survey-definition-versions.ts` — split into `summariseVersion`,
  `markCurrentVersion` and the existing `toVersionSummaries` over both.
- `src/lib/types/survey-definition-version.ts` — `SurveyDefinitionVersionSummaryRow`.
- `src/app/api/rounds/[roundId]/survey-definition/versions/route.ts`.
- Tests in `__tests__/survey-definition-versions.test.ts` and
  `__dbtests__/postgres-survey-definition-versions.test.ts`.
- `PROJECT_CONTEXT.md` ADR-046, `docs/critical-audit-2026-08-21.md`,
  `PROGRESS.md`.

Nothing in `docs/openapi.yaml`: the response body is byte-for-byte the contract
it already published.

## Exact Git state

See the commits on this branch. The only unstaged file is `next-env.d.ts`, which
is generated and belongs to the owner — stage with
`git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:db` — exit `0`, **84 tests, 84 pass**. Five are new and the
  first is the point: the SQL summary is compared against `summariseVersion`
  applied to the same rows, so a disagreement between the two stores fails
  rather than being restated as numbers that could both be wrong. The others
  cover a question with no `enabled` key (SQL drops it because the boolean cast
  is `NULL`, JavaScript because `undefined` is falsy), that no definition comes
  back at all, round scoping in a statement where the scope is a bound parameter
  rather than Prisma's doing, and the order at the retention cap.
- `npm run verify:core` — exit `0`, zero `not ok`, production build included.
- `src/lib/repositories/__tests__/survey-definition-versions.test.ts` — 10 tests,
  three new, holding the in-memory store to the same comparison.
- **The measurement above** was run three times per size against the disposable
  database, through the same Prisma client and adapter the product uses.

### Blocked or not run

- **The route was not walked over HTTP with the Prisma store behind it.** The
  route test drives the real handler over the in-memory store and asserts the
  body; the dbtests drive the real SQL through the real client. The one seam
  neither covers is the two together, which is the composition root, and it did
  not change. Recorded rather than claimed.
- `npm run test:e2e` — not run. No screen, redirect or role gate changed, and no
  spec covers the builder's history list.
- The Python suite — not run; nothing on that side changed.
- **Nothing deployed was contacted**, and no measurement was taken against it.
  The deployed link is where this change is worth the most and where it is least
  measured; the local numbers are stated as a floor and not as the benefit.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433` for both `verify:db` and the
measurements. The two throwaway measurement scripts were run from the repository
root, so `node_modules` would resolve, and deleted; `git status` was checked
after.

### Residual risk

- **The two stores now compute the same summary by different rules**, which is
  the arrangement that let the share-code defect live for months. The dbtest
  comparison is the guard, and it only guards the cases it seeds. A definition
  shape nobody writes today — `questions` absent, `enabled` as a string —
  resolves to a floor (empty title, zero questions) in SQL and would behave
  differently in JavaScript.
- **The 126-question figure is a projection**, taken by seeding definitions of
  that size, not by running the instrument that is due to replace the current
  one. The shape of a question may change with it.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin perf/the-history-list-stops-reading-every-questionnaire:main
```

No migration, no configuration and no secret is involved.
