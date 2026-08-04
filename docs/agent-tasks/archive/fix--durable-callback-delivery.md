# Retry a lost callback instead of losing the analysis behind it

## Metadata

- Branch: `fix/durable-callback-delivery`
- Base branch: `main`
- Base commit: `fb676f6`
- Current HEAD: `d54732e` plus this docs commit
- Status: ready for review and push
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Phase 7 of the AI harness improvement plan the owner is holding outside the
repository: bounded, idempotent delivery of a finished Stone Map, so a dropped
connection does not throw away work that has already been paid for.

## User-visible outcome

A round whose callback hits a network blip still gets its dashboard. Nothing
changes on screen when delivery succeeds first time, which is the normal case.

## Context

`HttpResultSink.post` made exactly one HTTP attempt and wrapped every failure
into one undifferentiated `RuntimeError`. The payload behind that attempt costs
roughly two dozen provider calls (eight dimension interpretations, eight metric
narratives, the overall summary, intervention adaptation), so a lost TCP
connection discarded all of it. Worse, the connection can drop *after* Core
persisted the result, leaving the worker unable to tell a lost reply from a
lost write.

Core's half of the idempotency was already in place and already tested:
`src/app/api/__tests__/mcp-integration.test.ts:363` sends an identical callback
twice and asserts `200` with `duplicate: false` then `duplicate: true`, and a
stale lease token answers `409`. So a retry of the same bytes under the same
run identity is safe today; only the retry was missing.

## Scope

- Bounded retry with exponential backoff, jitter and `Retry-After` in
  `HttpResultSink.deliver`.
- A typed `CallbackDeliveryError` that says whether another attempt could
  change the answer, so a verdict on the payload ends delivery at once.
- `parse_retry_after` moved out of `llm_transport` into a shared module, since
  two transports now read the header.

## Non-goals

- Persisting delivery state in Core. See the decision below.
- The async provider transport (plan Phase 6). `llm_transport` still blocks in
  a worker thread; this slice does not touch it beyond the moved helper.
- The immutable input snapshot (plan Phase 1).
- Any change to contract `1.0`–`6.0` wire semantics or to the callback route.

## Acceptance criteria

- A dropped connection or timeout is retried; a later success is delivered
  without an exception.
- `400`, `401`, `404` and `409` end delivery on the first attempt.
- `408`, `425`, `429` and `5xx` retry to the cap and then raise.
- Backoff grows between attempts and a `Retry-After` Core sends is taken as
  given rather than shortened.
- Every attempt carries the same bytes, the same URL and the same run identity,
  with the lease token in a header and never in the URL.
- The full Python suite passes.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/SKILL.md`: an `ai-analytics-service`
  change means the full `.venv/bin/python -m pytest`, and a callback change
  means the TypeScript boundary tests as well.
- `.agents/skills/shalomut-map/SKILL.md`: keep the Core/AI boundary and
  fail-closed transport.

## Relevant architecture and contracts

- No wire contract change, no Prisma schema change, no API surface change.
- `ResultSink.deliver` keeps its signature; only its promise got stronger.

## Decisions made

- **Two levels, not one.** `post` stays one HTTP attempt and owns the
  classification; `deliver` owns the budget. This keeps the existing tests that
  drive `post` directly honest about being single-attempt, and it names the
  difference between "send this" and "get this there".
- **Nothing about delivery is persisted.** The plan left the choice open and
  asked for the smallest model that keeps retry history and idempotency. The
  worker heartbeats every 30s against a 90s lease and keeps beating through the
  retries, so the ~7s budget cannot outlive the lease; Core's
  `callbackReceivedAt` already records the acknowledgement; and no reader
  outside the worker wants the attempt history yet. A delivery record becomes
  the right shape when one does.
- **`Retry-After` is honoured as sent, not capped**, matching the rule
  `llm_transport` already follows. The attempt cap is what bounds it.
- **Four attempts, 1s base, 8s cap, 0.5s jitter.** Worst case is roughly 7s of
  waiting plus four 5s timeouts, comfortably inside a heartbeated lease.

## Assumptions

- `503` from Core's durable write guard is treated as retryable. It signals a
  deployment without a database rather than a passing blip, but it is not a
  judgement on this payload, and the cap ends the retrying either way.

## Completed

- `CallbackDeliveryError` with `transient`, `status` and `retry_after`.
- Failure classification in `post`: `HTTPError` by status, transport errors as
  transient, a non-2xx that reaches the status check as a wrong address.
- The retry loop, backoff and logging in `deliver`, with injectable sleep and
  jitter so the sequence can be tested without waiting for it.
- `src/services/retry_after.py`, with `llm_transport` importing it instead of
  owning it.
- 16 tests in `tests/test_result_delivery.py`.
- `PROJECT_CONTEXT.md` ADR-017 and the delivery paragraph in
  `ai-analytics-service/README.md`.

## In progress

None.

## Remaining

Nothing in scope. The push is the owner's: the agent cannot push here.

## Changed files

- `ai-analytics-service/src/services/result_sink.py`
- `ai-analytics-service/src/services/retry_after.py` (new)
- `ai-analytics-service/src/services/llm_transport.py`
- `ai-analytics-service/tests/test_result_delivery.py` (new)
- `ai-analytics-service/README.md`
- `PROJECT_CONTEXT.md`, this file

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service`: 391 passed, 1
  warning. 375 before this slice plus the 16 new delivery tests; no existing
  test changed.
- `npm test`: 541 TypeScript tests, 0 failed — the callback route and the local
  Core boundary tests, unchanged by this slice and confirmed still green.

### Failed

None.

### Blocked or not run

- `npm run verify:core` beyond `npm test` and `npm run verify:db` were not run.
  No TypeScript, schema, migration or repository file changed.
- No browser smoke. No UI surface.
- Not exercised against a real dropped connection to deployed Core. What is
  proven is the classification and the retry sequence against a scripted
  transport, plus Core's existing duplicate-callback test for the other half.

### Environment

Local. Nothing deployed was touched or read.

### Residual risk

- The retry runs inside the worker process. A process restart mid-delivery
  still loses the result, and only a persisted delivery record would change
  that — deliberately out of scope above.
- `503` is retried on the assumption it is worth one more look. If a deployment
  really has no database, four attempts are spent to learn that.

## Failed approaches

- Wrote the new tests against an overridden `post`, which bypassed the
  classification the tests were meant to check and left `deliver` seeing raw
  `OSError`. Replaced by overriding `_post_callback`, so the real header
  policy, origin check and classification all run and the recorded evidence is
  the actual `urllib.request.Request` each attempt would have sent.
- Imported `parse_retry_after` from `llm_transport` directly. That made the
  result sink depend on the provider transport, pulling the provider rate
  limiter in at module load. Extracted to `src/services/retry_after.py`.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment alias
is touched.

## Questions requiring an owner decision

None open.

## Next concrete step

Hand the push to the owner: `git push origin fix/durable-callback-delivery:main`.
