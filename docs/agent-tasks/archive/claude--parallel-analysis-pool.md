# The service analyses several rounds at once

## Metadata

- Branch: `claude/parallel-analysis-pool`
- Base branch: `main`
- Base commit: `f0d868d`
- Current HEAD: `9d34572`, merged into `main`
- Status: merged; the deployed value stays `1`, so behaviour is unchanged until raised
- Last updated: 2026-08-18
- Last agent/tool: Claude Code

## Objective

Let one AI service process analyse more than one round at a time, so a burst of
closures drains in parallel instead of queueing behind a single lane.

## User-visible outcome

None by default. `AI_JOB_POOL_SIZE` stays `1`, which is exactly the behaviour
the service had before. A deployment that raises it gets faster drain of a
queue; no screen, contract or stored shape changes either way.

## Context

Asked after working through what happens when 10, then 50 schools close rounds
at once. The answer from the code: nothing breaks and nothing is lost, but
`run_forever` awaits `process_once`, so one process holds exactly one lease and
fifty rounds at ~3 minutes each serialise into ~2.5 hours.

The instinct is to add a second container. That is the wrong first move here:
`provider_rate_limiter` is a per-process object, so two containers keep two
private counters and together exceed the account's quota — the `429` failure
that killed every early live round. Filling the idle quota inside one process
has none of that risk and needs no new infrastructure.

## Scope

- `ai-analytics-service/src/config.py` — `AI_JOB_POOL_SIZE`, clamped 1..10.
- `ai-analytics-service/src/main.py` — `lifespan` starts N worker loops and
  stops all of them.
- `ai-analytics-service/src/services/ai_job_worker.py` — `worker_id_for_slot`
  and a per-process id base so slots are distinguishable.
- `ai-analytics-service/tests/test_ai_job_worker.py` — three tests.
- `.env.example`, `render.yaml`, `docs/ai-analysis-run-lifecycle.md`.

## Non-goals

- A second Render instance. It needs a shared rate limiter first; that is
  named as the prerequisite in the doc and not built here.
- Fairness between schools. The queue stays globally FIFO; more lanes drain it
  faster without changing whose round goes first.
- Notifying a manager that analysis finished. Untouched, still absent.
- Raising the deployed value. It stays `1` until someone decides otherwise.

## Acceptance criteria

- Default behaviour byte-identical: pool size 1, worker id with no suffix.
- N lanes hold N leases simultaneously in one process.
- Shutdown cancels and collects every lane, not the first.
- Slot ids satisfy Core's `isValidWorkerId` including at the 120-char bound.

## Relevant repository instructions

`shalomut-map`: the Python application boundary keeps its ports; nothing here
touches `AnalyticsSource`, `ResultSink`, `JobStore` or `TextGenerator`, and the
composition stays in `create_ai_analysis_job_worker`.

`shalomut-verification`: `ai-analytics-service` row means the full pytest run;
the env/runtime-config row means the full local suite. Both ran.

## Relevant architecture and contracts

ADR-006 owns durable execution: Core keeps job state, Python claims and leases.
A pool changes how many leases one process holds and nothing about who owns the
state — every lane goes through the same claim, heartbeat and callback.

ADR-010 says durable polling needs an always-available process. Still true; the
pool makes better use of the one process that requirement already pays for.

## Decisions made

- **Concurrency inside the process, not more processes.** The rate limiter is
  per-process by construction and documented as such. Lanes share it; instances
  would not. This is the whole reason the cheap option is also the correct one.
- **Default 1, ceiling 10.** Default preserves today's behaviour exactly.
  Ceiling because past roughly `60/11` the pace binds and extra lanes only queue
  behind it, while each lane still holds a lease Core must keep alive.
- **A per-process id base, with slot suffixes.** Four lanes read as one
  container (`worker-<uuid>:1` … `:4`) rather than four unrelated names. Without
  the suffix, `ai_analysis_runs.worker_id` could not say which lane holds a run;
  without the shared base, it could not say they share a machine.
- **No suffix at size 1.** An operator reading `worker_id` sees no change until
  they ask for a pool.
- **The base is trimmed, not the composed id.** Core's `isValidWorkerId` caps at
  120 characters and refuses anything longer, so the suffix has to fit inside
  the budget rather than overflow it.

## Assumptions

- Provider quota is the binding limit past ~5 lanes, from the deployed pace of
  60/min and a measured ~28 calls per round. If the real tier differs, the
  useful ceiling differs; the clamp is deliberately generous rather than tuned.
- The graph holds no cross-round state. Checked: `AnalyticsGraphEngine.ainvoke`
  writes nothing to `self`, and the blocking provider call and its rate-limit
  sleep already run under `asyncio.to_thread`, so lanes do not block each other.

## Completed

Everything in Scope.

## In progress

Nothing.

## Remaining

Nothing on this branch. Whether to raise the deployed value is the user's call.

## Changed files

- `ai-analytics-service/src/config.py`
- `ai-analytics-service/src/main.py`
- `ai-analytics-service/src/services/ai_job_worker.py`
- `ai-analytics-service/tests/test_ai_job_worker.py`
- `.env.example`
- `render.yaml`
- `docs/ai-analysis-run-lifecycle.md`
- `docs/agent-tasks/active/claude--parallel-analysis-pool.md` (new)

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` in `ai-analytics-service` — **516 passed**
  (513 before, 3 added).
- The concurrency test was proven load-bearing by mutation: forcing the two
  lanes to run sequentially failed it with `assert 1 == 2`, and reverting
  restored the pass. A test that cannot fail proves nothing, so this was checked
  rather than assumed.
- Real `lifespan` exercised with `AI_JOB_POOL_SIZE=4`: four tasks started, four
  distinct ids sharing one process base
  (`worker-f5570f83-…:1` … `:4`), all four stopped on shutdown.
- Default path exercised with no `AI_JOB_POOL_SIZE`: one lane, id
  `worker-<uuid>` with no suffix — unchanged from before.
- Clamp checked at both ends: `0 → 1`, `99 → 10`.
- Core suite unaffected: `npm run verify:core` passes end to end (1186 node
  tests, lint, typecheck, build), and `npm run verify:db` passes 36 of 36
  against a real PostgreSQL 16 cluster.
- The shutdown test was proven load-bearing the same way: cancelling only the
  first slot made the pool hang on shutdown (`SHUTDOWN HUNG — uncancelled slots
  block the gather`), and restoring the loop fixed it.

### Failed

None.

### Blocked or not run

- Nothing was run against the deployed environment. The provider account is out
  of credit (`docs/shalomut-tracker-handoff.md`), so a deployed run would prove
  only the `http_429` path, and the deployed value stays `1` regardless.

### Environment

Local. `verify:db` ran against the disposable PostgreSQL 16 cluster on port
5433. No deployed writes, no secrets, no alias changes.

### Residual risk

Low at the shipped default, which is a no-op. At a raised value the new
behaviour is several leases per process; the claim path was already built for
concurrent claimants and is covered by Core's existing integration test for one
active run and one lease owner across repository instances.

## Failed approaches

The first version minted a fresh `uuid4()` per slot, so four lanes carried four
unrelated names and `worker_id` stopped identifying the process at all. Replaced
with one cached base per process plus slot suffixes.

## Known risks

The useful ceiling depends on the provider tier, and nothing in the repository
can read that tier. If the pace is ever raised well above 60/min, the clamp of
10 becomes the limit instead of the quota — a number to revisit then, not a
defect now.

## Approval gates

None. No secrets, credentials, aliases or database state are touched, and the
deployed value is unchanged.

## Questions requiring an owner decision

- Whether to raise `AI_JOB_POOL_SIZE` on the deployed service, and to what. My
  reading of the numbers says 4–5 is the useful range at the current pace.
- Whether the provider tier should be confirmed or raised first; that, not the
  pool, is the real ceiling for 50 schools.

## Next concrete step

None. Merged into `main` as `9d34572`.

What outlives this branch is a decision, not work: whether to raise
`AI_JOB_POOL_SIZE` on the deployed service, and whether to confirm the provider
tier first. Both are recorded in
[`shalomut-tracker-handoff.md`](../../shalomut-tracker-handoff.md) under what
waits on an owner decision, because an archived file is not where anyone looks
for what is still owed.
