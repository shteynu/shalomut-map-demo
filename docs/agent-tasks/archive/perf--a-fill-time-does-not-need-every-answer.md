# A fill-time report does not need every answer of the round

## Metadata

- Branch: `perf/a-fill-time-does-not-need-every-answer`
- Base branch: `main`
- Base commit: `eb46b87` — **which is the previous task's branch, not `origin/main`**
- Current HEAD: see **Exact Git state**
- Status: complete and verified
- Landed on `main` as `23180d5`, pushed by the owner 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the 2026-08-21 audit's «Экраны раунда и breakdown грузят ответы и попытки
по два раза за рендер», anchored at `src/app/breakdown/page.tsx:62`.

## What the record said, and what was actually there

The record is from 2026-08-21 and four tasks have moved this code since. Both
halves had to be re-read rather than acted on.

**The round screen's half was still true, and understated.** The funnel and the
fill-time report each fetched the round's attempts for themselves — one query,
twice, on one render. And `RoundFillingService` reads `submittedAt`,
`anonymousTokenHash` and `visibleSeconds` off each response, plus a count, and
asked for the responses *whole* — which joins every `question_answers` row of the
round.

**The breakdown screen's half had narrowed on its own.** It reads the round's
responses after `loadManagerContext` computed the analytics, so it double-reads
only when the context recomputes: a closed round whose basis of calculation
changed. A collecting round reads no responses at all (ADR-030), and a closed one
reads its stored aggregate (ADR-035).

**The proposed fix did not fit either.** «Пробросить уже загруженные массивы в
сервисы (они принимают plain arrays)» — they did not. Both took repositories and
did their own reading. Passing arrays meant changing the seam, which is what was
done.

## Measurement

Seeded at the size the audit itself names: 300 staff, the 126-item instrument,
37,800 answer rows. Warmed, twenty samples, local PostgreSQL on `:5433`.

| read | rows | bytes | median | min |
| --- | --- | --- | --- | --- |
| whole responses (`include: answers`) | 300 | 6.4 MB | 56.9 ms | 50.4 ms |
| timings (`select` of five columns) | 300 | 73.5 KB | 1.4 ms | 1.2 ms |

The deployed database is not on the same continent as the process reading it, so
the millisecond figure is a lower bound and the byte figure is the one that
travels. The script was written at the repository root, run, and deleted —
`node_modules` does not resolve from the scratchpad.

## Decisions made

1. **`findResponseTimingsByRoundId` returns `Omit<SurveyResponseRecord, 'answers'>`.**
   Removed from the type rather than emptied, so a consumer reaching for the
   answers does not compile — the guarantee ADR-045 gave the manager context.
2. **`select` rather than dropping `include`.** Naming the columns keeps a future
   column off this read by default and makes the absent join visible.
3. **Both services take what they report on.** `getRoundFunnel(attempts,
   completed)` and `getRoundFilling(round, attempts, timings)`, both synchronous
   now. The reads live in `loadRoundActivity`, an entrypoint — where ADR-008 puts
   them, and the only place that could have seen the duplication at all.
4. **One loader for two reports.** Not because the reports are related — the
   funnel is about who arrived and the filling report about who stayed — but
   because they are one screen's worth of the same collection.
5. **The funnel's `completed` is `responses.length`.** Same number as its old
   `COUNT(*)`, still counted from stored responses rather than completion
   beacons, one query fewer. A round with no questionnaire now reads narrow rows
   where it used to read a count; such a round cannot have been answered, so the
   rows are none.
6. **The breakdown half is left open and narrowed in the record.** Closing it
   means passing responses out of `ManagerContextService.load`, widening a seam
   seven other screens use, for a case that is now conditional.
7. **The test suites keep seeding through the real in-memory stores.** Each got
   one local helper doing the two reads the screen does, so the 24 rewritten call
   sites are the seam and not a fake, and no assertion changed.

## Changed files

- `src/lib/types/backend.ts` — `SurveyResponseTiming`.
- `src/lib/repositories/interfaces.ts` and both survey repositories.
- `src/lib/services/survey-funnel.service.ts`,
  `src/lib/services/round-filling.service.ts` — pure and synchronous.
- `src/lib/server/manager-context.ts` — `loadRoundActivity` replaces
  `loadRoundFunnel` and `loadRoundFilling`; `src/app/round/page.tsx`.
- Tests: new `src/lib/server/__tests__/a-round-screen-reads-its-collection-once.test.ts`
  and `src/lib/repositories/__dbtests__/postgres-response-timings.test.ts`; the
  two service suites rewritten through a helper each.
- `PROJECT_CONTEXT.md` ADR-050, `docs/critical-audit-2026-08-21.md`,
  `PROGRESS.md`.

Nothing in `docs/openapi.yaml`: no endpoint changed. The round screen is a server
component, not an endpoint.

## Exact Git state

**This branch sits on top of `perf/the-tables-that-only-grow-get-a-ceiling`,
because that task's two commits are not on `main`.** The owner reported pushing
them; `git ls-remote origin main` says `origin/main` is still `99a896c`, so the
push did not land. Both branches are wanted and in this order.

- `fb8e817` — code and tests.
- The documentation commit follows it; see `git log`.

The only unstaged file is `next-env.d.ts`, which is generated and belongs to the
owner — stage with `git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, zero `not ok`, production build included.
- `npm run verify:db` — exit `0`, **97 tests, 97 pass** (93 before, 4 new).
- `npm run test:e2e` — **24 passed**, including «a manager signs in and the round
  screen reports its numbers», which is the screen this changed. Run because
  `verify:core` does not run Playwright and this rewrote a screen's data path.
- **Four regressions were planted and all four were caught**: the two reports
  reading attempts separately again; the fill-time report asking for whole
  responses; the narrow read losing its `where`; and `null` leaking into
  `visibleSeconds` instead of the column being absent.
- The PostgreSQL suite asserts the narrow read returns exactly the wide read
  minus its answers, on the same rows, including both nullable columns.

### Blocked or not run

- **Nothing was walked in a browser by hand.** Playwright covers the screen.
- **The measurement was not repeated against the deployed database.** It would
  need 37,800 seeded answer rows there; the local number is reported as the lower
  bound it is.
- **No `EXPLAIN` was taken.** The claim is about what is fetched, which the byte
  and time figures measure end to end, and about the join, which the type and the
  call-count tests hold.
- The Python suite — not run; nothing on that side changed.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433`.

### Residual risk

- **`findResponsesByRoundId` still exists and is still right** for the map, which
  is computed from the answers. Nothing stops a future report reaching for it out
  of habit except that the narrow read is now the obvious one on this path.
- **The two services are no longer the ones reading**, so a future caller must
  remember both reads. There is one caller, and it is the loader.
- **The breakdown screen still double-reads** in the one case named above.

## Next concrete step

Hand the owner the two pushes, in this order — the first did not land last time:

```
git push origin perf/the-tables-that-only-grow-get-a-ceiling:main
```

```
git push origin perf/a-fill-time-does-not-need-every-answer:main
```
