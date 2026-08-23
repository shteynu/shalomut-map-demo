# One transaction finishes a paid run

## Metadata

- Branch: `fix/one-transaction-finishes-a-paid-run`
- Base branch: `fix/the-invitation-creates-the-reader-it-promised` (`b1cea03`),
  which fast-forwards from `origin/main` at `c929d9c`
- Base commit: `b1cea03`
- Current HEAD: `3eada84`, an ancestor of `main`. The branch is `169dd32`, `3eada84`,
  oldest first.
- Status: complete, landed on `main`; archived 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the 2026-08-21 audit's medium finding «Запись финиша прогона и колонки
раунда не атомарна, а провал legacy-записи рапортуется как 404», anchored at
`src/lib/server/ai-insights-service.ts:232`.

## What was wrong

Two defects in the same six lines.

1. **Not atomic.** `aiAnalysisRunRepo.finish` closed the durable run, then
   `aiInsightsRepo.save` wrote the round's legacy `aiInsights` column as a
   separate write. A crash or a dropped connection between them left a run
   marked `succeeded` beside a column holding the map it was meant to replace.
   Each half is internally valid, so nothing downstream can notice.
2. **The failure was reported as the wrong thing, and this is the expensive
   half.** `save` catches everything and returns `false`; `false` was reported
   as `round_not_found`, which the route answers `404`. `result_sink.py`'s
   `_is_transient_status` retries `408`, `425`, `429` and every `5xx` and
   nothing else, and its `CallbackDeliveryError` docstring says why: a `404` is
   a verdict about the analysis, and repeating the request repeats the verdict.
   So a transient database error made the worker give up on an analysis that
   was correct and had been paid for.

## Decisions made

1. **The route opens the transaction; the service asks for a runner.** Only an
   entrypoint may resolve the wiring (ADR-008), and `runInTransaction` is a
   second resolution the composition lint already knows about. Passing a
   `AiCallbackWriteRunner` rather than a repository set lets the service decide
   what goes inside — which matters here, because everything it reads,
   validates and recomputes must stay outside. The lock is opened on the way
   back from a model call; holding it across `AnalyticsService` would be worse
   than the finding.
2. **A refused write is `write_failed` → `500`.** The round is read at the top
   of the callback, so a `false` from `save` is a failed write far more often
   than a vanished round — and a round that really did vanish is caught by that
   read on the retry, which answers the `404` from the place that knows. The
   `IAiInsightsRepository` interface is unchanged: widening `save`'s return
   would have rippled through four implementations to say something the caller
   already knows.
3. **Verdicts are returned, failures are thrown.** `run_not_found` and
   `lease_stale` travel out of the write block as results and keep their `404`
   and `409`; nothing has been written when they are decided. Only the write
   failure throws, in its own `AiInsightsWriteFailed` class so the `catch`
   cannot relabel an unrelated bug as retriable.
4. **The metrics moved after the commit.** They sat between the two writes.
   Observability may not run inside a transaction (ADR-041), and a counter
   saying a job completed was, until the commit, saying something untrue.
5. **`__dbtests__` added to `check-version-literals.mjs`'s exemption.** The
   composition-root, runtime-fixture and tenant-chokepoint gates already spell
   both directories; this one spelled only `__tests__` because no database test
   had ever named a contract version. Found by the new test, fixed with its own
   assertion.

## Changed files

- `src/lib/server/ai-insights-service.ts` — `AiCallbackWriteStores`,
  `AiCallbackWriteRunner`, the `write_failed` outcome, `AiInsightsWriteFailed`,
  the rewritten write block, the metrics moved after it.
- `src/app/api/rounds/[roundId]/ai-insights/route.ts` — `runInTransaction`
  passed in, and the `500` for `write_failed`.
- `scripts/check-version-literals.mjs` and its test.
- New `src/lib/server/__tests__/one-transaction-finishes-a-paid-run.test.ts`.
- New `src/lib/repositories/__dbtests__/postgres-ai-callback-atomicity.test.ts`.
- `docs/openapi.yaml` (+ regenerated `public/openapi.json`),
  `PROJECT_CONTEXT.md` ADR-043 and the composition-root section,
  `docs/critical-audit-2026-08-21.md`, `PROGRESS.md`.

## Verification evidence

### Passed

- `npm run verify:db` — exit `0`, **70 tests, 70 pass**. The five new PostgreSQL
  tests are what prove this change: a refused column write rolls the run
  transition back, the same failure without a transaction leaves the stores
  disagreeing (the negative control), a successful callback commits both halves,
  and the retry after a rolled-back failure finishes the run.
- `npm run verify:core` — exit `0`, zero `not ok`.
- `src/lib/server/__tests__/one-transaction-finishes-a-paid-run.test.ts` — 5
  tests. One of them deliberately asserts the divergence, because an in-memory
  `Map` has nothing to roll back and a test claiming otherwise would be false.

### Blocked or not run

- `npm run test:e2e` — not run. No screen, route surface or redirect changed;
  the diff is a server-side write path and a status code on a machine-to-machine
  callback. (Running it is now the standing rule for screen changes — see the
  previous branch's task file.)
- **No end-to-end run against the real AI service.** The change alters what Core
  answers a worker, and the worker's classification of that answer was read from
  `result_sink.py` rather than exercised. A real proof would need a callback to
  fail its column write on a deployed Core while the Render worker is watching,
  which is not something either side can be asked for on demand.
- The Python suite was not run: no contract, schema or Python file changed.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433`, supplied by `verify:db`.

### Residual risk

- **The lease window is unchanged.** If the lease expires during the worker's
  backoff, the retry is refused as `stale` and the run waits for the reaper to
  requeue it. Pre-existing, named in ADR-043, not paid for here.
- The `500` body is a fixed English sentence, so it leaks nothing — but the
  route's outer `catch` still interpolates `error.message`, which is a separate
  open audit row (`:596`) and was left alone.

## Next concrete step

Hand the owner the push. This branch sits on top of
`fix/the-invitation-creates-the-reader-it-promised`, so one push carries both in
order:

```
git push origin fix/one-transaction-finishes-a-paid-run:main
```
