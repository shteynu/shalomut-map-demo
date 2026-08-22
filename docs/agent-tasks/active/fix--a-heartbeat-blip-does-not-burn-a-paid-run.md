# A heartbeat blip does not burn a paid run

## Metadata

- Branch: `fix/a-heartbeat-blip-does-not-burn-a-paid-run`
- Base branch: `main`
- Base commit: `bda7165`
- Current HEAD: `25c3939`, on top of `e1a0081`
- Status: code done, verified, **not pushed**
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the resilience entry of the 2026-08-21 audit: one failed heartbeat, or one
transient error at the end of a run, terminally failed a paid AI analysis on its
first attempt.

## User-visible outcome

A school whose analysis ran while Core was briefly unreachable still gets its
map. Before this, one 10-second timeout or one `502` mid-run cancelled the
three-minute analysis, spent up to 28 paid provider calls for nothing, and left
the run in a state `claimNext` never picks up again — with nobody notified, so a
manager had to notice the absence and ask for a re-run themselves.

## Context

`heartbeat()` treats only `404` and `409` as lease loss and `raise_for_status()`
on everything else. That exception escaped the heartbeat loop, `finally`
cancelled the analysis, and `except Exception` sent `fail(..., 'worker_error')`.
The three attempts a run is allowed covered only a worker that died silently.
`config.py` had claimed since the beginning that the 30 s cadence against a 90 s
lease "leaves a full retry window" — a window the heartbeat code never used.

## Scope

- `ai-analytics-service/src/services/ai_job_worker.py` — `_renew_lease`, the
  lease budget in `_run_with_heartbeat`, `LeaseUnreachableError`,
  `is_worth_another_attempt`, and the classification in `process_once`.
- `ai-analytics-service/src/config.py` — the comment that promised the window
  now says who spends it.
- `ai-analytics-service/tests/test_ai_job_worker.py` — seven new cases.

## Non-goals

- An endpoint that releases a lease early. Core has none, so a released run
  waits out the remainder of its 90 seconds before it can be reclaimed. Adding
  one is a Core change with its own contract.
- Notifying anyone when a run is exhausted. `lease_exhausted` is still a state
  nothing tells a manager about; that is a separate finding.
- The remaining two high findings of the audit.

## Acceptance criteria

- A heartbeat that could not be sent is retried inside the same beat.
- A `404`/`409` answer is not retried.
- A lease nobody could renew is released without `fail()`, after the lease
  Core granted has actually run out — not after the first silent renewal.
- A delivery that ran out of attempts against an unreachable Core is released;
  a refused payload still fails the run once.

## Relevant repository instructions

- `AGENTS.md`: verify in proportion to risk. This path spends money, so every
  new rule was mutated and watched to fail.
- `AGENTS.md`: living documents follow the code — `config.py`'s promise,
  `PROGRESS.md`, the handoff and the audit entry all describe this behaviour.

## Relevant architecture and contracts

- Core's `claimNext` reclaims a run when `leaseExpiresAt <= now` and
  `attemptCount < maxAttempts` (3), and marks an expired run beyond that
  `lease_exhausted`.
- `AI_ANALYSIS_JOB_LEASE_MS = 90_000` in `src/lib/server/ai-analysis-worker.ts`,
  mirrored as `CORE_LEASE_SECONDS` and pinned by a test that reads Core's file.
- `CallbackDeliveryError.transient`, which `HttpResultSink` already used to
  decide whether to retry a callback.
- ADR-034, added by this task.

## Decisions made

- **The worker catches every exception from `client.heartbeat`, not a list of
  httpx types.** `JobStore` is a port; a worker that names the transport's
  exceptions knows the transport. Treating any failure to get an answer as "the
  renewal did not happen" is also the conservative reading — it can delay a
  release, never a data loss.
- **`LeaseUnreachableError` subclasses `LeaseLostError`.** Both mean stop
  working on this run; neither means it is finished. The subclass is what keeps
  a future `except LeaseLostError` from accidentally failing it.
- **The lease bounds the decision, not an attempt counter.** A counter would
  have to be re-derived every time the cadence changed; the elapsed time since
  the last successful renewal is the thing Core actually measures.
- **A transient `CallbackDeliveryError` is released.** The signal already
  existed and already meant "this says nothing about the payload". Retrying is
  safe because every attempt sends the same bytes under the same run identity,
  which Core recognises as the result it may already hold.

## Assumptions

- A reclaimed run re-runs the analysis from the beginning, so its provider calls
  are spent again. Bounded by the three attempts; recorded in ADR-034 as the
  cost of the change rather than hidden.

## Completed

Everything in Scope, plus ADR-034, `PROGRESS.md`, the handoff and the audit
file.

## In progress

Nothing.

## Remaining

Nothing in the tree. The push is the owner's.

## Changed files

Added: this file.

Modified: `ai-analytics-service/src/services/ai_job_worker.py`,
`ai-analytics-service/src/config.py`,
`ai-analytics-service/tests/test_ai_job_worker.py`, `PROJECT_CONTEXT.md`,
`PROGRESS.md`, `docs/shalomut-tracker-handoff.md`,
`docs/critical-audit-2026-08-21.md`.

Moved into `archive/` in `e1a0081`, both already finished and on `main`:
`fix--a-failed-re-analysis-keeps-the-map.md` and
`fix--a-status-write-that-failed-says-so.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- `ai-analytics-service`: `python -m pytest`, 576 of 576.
- `npm run verify:core` unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1393 / # pass 1393 / # fail 0`, zero `not ok`, the Python suite
  green inside `verify:ai`, and the build completed. Run before the two
  commits; nothing but documentation changed after it.
- **Seven mutation passes**, each restored from a scratchpad copy of the fixed
  file and each producing exactly the expected failure:
  1. one heartbeat attempt instead of three → the renewal test fails;
  2. a `404`/`409` answer retried like a blip → the refusal test fails;
  3. `LeaseUnreachableError` routed to `fail()` → the release test fails;
  4. the transient-delivery branch removed → the undelivered-result test fails;
  5. `is_worth_another_attempt` widened to every `CallbackDeliveryError` → the
     refused-payload test fails;
  6. `CORE_LEASE_SECONDS` changed to 60 → the mirror test fails;
  7. the lease budget ignored, releasing at the first silent renewal → the
     release test fails.

### Failed

- **The first version of mutation 1 caught nothing.** With the retry removed,
  the next heartbeat tick still sent a heartbeat, so a test counting beats
  through `process_once` could not tell an in-renewal retry from the next beat.
  The rule now has its own test against `_renew_lease`, which pins the count.

### Blocked or not run

- No run against a real Core or a real provider. Every case here is a failure
  mode of the transport between the two, and reaching it live would mean
  breaking Core mid-analysis and paying for the run. The fake client answers
  exactly what Core's own routes answer — `False` for `404`/`409`, an exception
  otherwise — and `CallbackDeliveryError` is the sink's own type.
- `npm run verify:db` not run: no Prisma, schema, migration or repository code
  changed.

### Environment

Local worktree; `ai-analytics-service/.venv` for pytest. No `GEMINI_API_KEY`
was needed and no provider call was made.

### Residual risk

A defect inside `client.heartbeat` itself — a `TypeError`, say — now reads as an
unreachable Core, so the run is released and reclaimed up to three times,
spending its provider calls each time before ending as `lease_exhausted`. It is
bounded and logged with a traceback on every attempt, but it is louder in the
logs than on the bill.

## Failed approaches

One, recorded above: a mutation that proved nothing, and the test that had to be
written against `_renew_lease` to make the claim real.

## Known risks

`is_worth_another_attempt` is the only place a failure is classified. Anything
new that is genuinely transient and does not arrive as a transient
`CallbackDeliveryError` will be failed terminally — which is the safe default,
but it is a default that has to be revisited deliberately.

## Approval gates

None. No credentials, secrets, aliases or authentication configuration were
touched.

## Questions requiring an owner decision

None. 40 audit entries remain open, two of them high: the per-screen analytics
recompute and the administrator overview's N+1.

## Next concrete step

The owner pushes `fix/a-heartbeat-blip-does-not-burn-a-paid-run` to `main`.
Vercel rebuilds Core; the AI service on Render deploys separately, so the worker
change only reaches the deployed run loop once that service is redeployed. After
that, archive this file and take the next audit entry.
