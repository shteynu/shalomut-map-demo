# The provider quota is shared by every live worker, not privately doubled

## Metadata

- Branch: `fix/the-quota-is-shared-by-every-live-worker`
- Base branch: `main`
- Base commit: `819a3fa`
- Current HEAD: `a56132d` (docs commit pending)
- Status: implemented and verified locally; not on `main`, not deployed
- Last updated: 2026-08-23
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Close the last fully open medium of `docs/critical-audit-2026-08-21.md` —
*«Слой ИИ-воркера нельзя масштабировать за пределы одного процесса»*
(`ai-analytics-service/src/services/provider_rate_limit.py`). Everything that
protects the paid Gemini quota — the RPM pace, the concurrency semaphore, the
provider health view — is module state in one process. A second Python process
(a deliberate second Render instance, a `WEB_CONCURRENCY` above one, or the
overlap of an old and a new container during a zero-downtime deploy) keeps its
own private counter, so the two together send at twice the configured pace
against a quota counted once per key. Nothing catches it and nothing forbids it.

## User-visible outcome

None directly. The manager-visible failure this prevents is the one that killed
every early live round: `429` from the provider mid-analysis, which surfaces as
a round whose map arrives late, partly model-written, or not at all.

## Context

- Audit record: `docs/critical-audit-2026-08-21.md`, section `01`, heading
  «Слой ИИ-воркера нельзя масштабировать за пределы одного процесса».
- Operational blocker 9 in `docs/shalomut-tracker-handoff.md` states the
  consequence: a second Render instance is **not** the next step after raising
  `AI_JOB_POOL_SIZE`, precisely because `provider_rate_limiter` is per-process.
  This task is what removes that coupling.
- The deployment's real pace is 30 rpm, not 60: `render.yaml` points
  `LLM_MODEL_HEAVY` at the fast model, and `requests_per_minute_for` takes the
  stricter tier when one name is configured on both.
- Core already stores `ai_analysis_runs.worker_id` and `lease_expires_at` and
  already has the index `[state, leaseExpiresAt, queuedAt]`, so «who is alive
  right now» is answerable without a migration.

## Scope

- `ai-analytics-service`: `ProviderRateLimiter` learns how many worker
  processes are sending against the same key and divides the pace among them.
- The number is observed rather than declared: Core reports the worker ids
  holding a live lease, on the two round-trips the worker already makes (claim
  and heartbeat).
- Core: one read-only repository method plus the additive response field on the
  claim and heartbeat routes.
- Documentation: ADR, the audit record, `PROGRESS.md`, the handoff's blocker 9.

## Non-goals

- No shared external store (Upstash or otherwise) for the limiter. The service
  has no database of its own and Core is the only thing both processes can see.
- No change to `AI_JOB_POOL_SIZE`'s deployed value — how many rounds the
  deployment analyses at once stays the owner's decision (blocker 9).
- `provider_health` and the concurrency semaphore stay per-process. The quota is
  what a second process actually overspends; health is an opinion each process
  is entitled to form on its own.
- No new Render instance is started by this task.

## Acceptance criteria

- With one worker process, the pace is exactly what it is today.
- With N processes holding live leases, each process paces itself at
  `requests_per_minute_for(model) / N`, so the account's spend is unchanged.
- A process with several pool lanes counts as **one** sender, not one per lane.
- A Core that does not send the new field leaves the worker at today's
  behaviour (consumer-first deployment window).
- Python suite and the TypeScript suite pass.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-tracker/SKILL.md`,
`.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

The versioned AI analytics contract (`1.0`–`6.0`) is **not** touched: the job
API between Core and the worker is operational plumbing, not the analytics
contract. The new response field is additive and optional on both sides.

## Decisions made

- **Divide the pace, do not refuse the second process.** The audit offered
  either. Dividing is strictly better here: it is what makes scale-out work at
  all (a round is ~11 calls a minute against a configured 30, so two processes
  at 15 each still run faster than one at 30 does serially), and refusing would
  turn a zero-downtime deploy — where old and new containers overlap by design —
  into a container that refuses to start.
- **Observed, not declared.** An `AI_WORKER_FLEET_SIZE` env would be one more
  number to forget, and it cannot see the deploy overlap at all.
- **Core returns the ids, the worker collapses them.** The `base:slot` shape of
  a worker id is the worker's own invention (`worker_id_for_slot`), so Core
  counting distinct ids would read one three-lane process as three senders.

## Assumptions

- A worker that holds no live lease is not sending to the provider, so it does
  not need to be counted. It learns the count in the claim response the moment
  it takes work.

## Completed

- **`c6635ea` — Core names every worker that is spending the quota.**
  `IAiAnalysisRunRepository.readLiveWorkerIds(limit)` in both implementations
  (Prisma `groupBy` on the existing `[state, leaseExpiresAt, queuedAt]` index;
  no migration), the additive `liveWorkerIds` field on the claim and heartbeat
  responses, `AI_ANALYSIS_LIVE_WORKER_ID_LIMIT = 32`, OpenAPI source and
  generated mirror, unit, route and PostgreSQL-backed tests.
- **`a56132d` — the pace is a share.** `ProviderRateLimiter.set_sending_processes`
  multiplies the booking interval by the number of sending processes;
  `process_base_of` / `count_sending_processes` collapse `base:lane` so a pool
  is one sender; `CoreJobClient` reports the observation from claim and
  heartbeat through an injected callback. Config and README prose corrected
  where they still called the single-process assumption a fact.
- Documentation: ADR-053, the audit record (fully closed, plus the neighbouring
  throughput bullet closed in the limiter's part), `PROGRESS.md`, and the
  handoff's blocker 9 and `Now`.

## In progress

- Nothing.

## Remaining

- Land on `main` (`git push origin fix/the-quota-is-shared-by-every-live-worker:main`),
  which is the owner's to run.
- **This push rebuilds the AI service.** `ai-analytics-service/**` is in
  Render's `buildFilter`, so unlike the last five landings the two endpoints
  will not sit at different commits afterwards.

## Changed files

Core: `src/lib/repositories/interfaces.ts`,
`src/lib/repositories/prisma/{prisma-ai-analysis-run.repository,prisma-client}.ts`,
`src/lib/repositories/in-memory/in-memory-ai-analysis-run.repository.ts`,
`src/lib/server/ai-analysis-worker.ts`,
`src/app/api/ai-analysis-runs/claim/route.ts`,
`src/app/api/ai-analysis-runs/[runId]/heartbeat/route.ts`,
`docs/openapi.yaml`, `public/openapi.json`, and three test files.

Service: `ai-analytics-service/src/services/{provider_rate_limit,ai_job_worker}.py`,
`ai-analytics-service/src/config.py`, `ai-analytics-service/README.md`, and two
test files.

## Verification evidence

### Passed

Local, 2026-08-23:

- `npm run verify:core` — exit 0. Includes `lint:doc-numbers`, `lint:skills`,
  `lint:python-deps`, `typecheck`, `npm test` (1616 tests), `verify:ai`, `lint`
  and `build`.
- `npm run verify:db` — 108 tests, exit 0, against the disposable local
  PostgreSQL on `127.0.0.1:5433`. This is what proves the Prisma `groupBy`
  rather than the in-memory stand-in: two schools, two workers, one lease
  expired by hand, and a finished run releasing its worker id.
- `ai-analytics-service/.venv/bin/python -m pytest` — 587 passed. Run with
  `GEMINI_API_KEY` stripped from the child environment; no provider call is on
  this path.

What the new tests actually pin, rather than the count of them: the pace
doubles with a second sender and is unchanged with one; a zero count is read as
one; an unpaced tier stays unpaced; three lanes are one sender and
`render:frankfurt` is not a lane; an absent field is not an observation; a
refused renewal and an unreadable body both leave the pace alone.

### Failed

- None.

### Blocked or not run

- **Deployed walk: not run**, and not planned. Nothing here is visible from
  outside, and the behaviour only appears with two processes against the paid
  key — proving it on the deployment would mean paying for a second container
  and a live round to watch it halve.
- `npm run test:e2e`: not run. No screen, route visibility or redirect changed.

### Environment

Local worktree, disposable local PostgreSQL for repository tests.

### Residual risk

Two processes that claim within the same instant can each see only themselves
and both run at full pace until the next heartbeat corrects them — at most one
heartbeat interval of overshoot, which the existing `Retry-After` handling
already absorbs.

## Failed approaches

- None yet.

## Known risks

- The count is a moment's truth: a peer that dies is still counted until its
  lease expires (≤90 s), during which this process runs slower than it could.
  Slower is the safe direction.

## Approval gates

None. No secret, credential, authentication configuration or deployment alias
is touched.

## Questions requiring an owner decision

- Blocker 9 (how many rounds the deployment analyses at once) stays open and is
  unchanged by this task; what changes is that a second instance stops being
  forbidden by the limiter's shape.

## Next concrete step

Hand the push over: `git push origin fix/the-quota-is-shared-by-every-live-worker:main`.
Nothing in this branch is waiting on more code.
