# Persist the AI analysis run lifecycle

## Metadata

- Branch: `feat/durable-ai-jobs`
- Base branch: `origin/main`
- Base commit: `cb8bed3`
- Current HEAD: `cb8bed3`
- Status: implementation complete in the local worktree; committed locally
- Last updated: 2026-07-30
- Last agent/tool: Codex

## Objective

Replace the overloaded `SurveyRound.aiInsightsUpdatedAt` dispatch lease with a
durable `AiAnalysisRun` lifecycle for PR 3 of the accepted wellbeing
refactoring plan.

## User-visible outcome

AI analysis state survives request/process restarts and is reported from an
explicit `queued` / `running` / `succeeded` / `failed` lifecycle rather than an
inferred `idle` / `running` / `stalled` timestamp heuristic. Duplicate or late
callbacks do not corrupt the current result.

## Context

- Plan source of truth: `docs/wellbeing-refactoring-plan-v4-review.md` on
  `docs/update-wellbeing-refactoring-plan` at `45e75c3`.
- The current branch intentionally starts from the shared baseline `cb8bed3`;
  the documentation-plan branch is not merged into this implementation PR.
- The review identifies this as PR 3, size L, expected in 2-3 commits, and says
  it must not run in parallel with product-backlog items 5-6.

## Scope

- Persist `AiAnalysisRun` records and their lifecycle in PostgreSQL.
- Replace the timestamp-based claim with explicit enqueue/claim/lease/heartbeat
  transitions and a polling worker boundary.
- Make callback completion idempotent and tied to the correct run.
- Expose the new lifecycle to existing API/UI consumers.
- Include the A3 observability definitions in the PR 3 DoD: queued, running,
  succeeded, failed, stalled and retry counts; queue wait, processing duration
  and callback delivery latency; contract validation failures by version and
  violation; partial-map rate; duplicate-submission conflicts.
- Preserve current privacy and versioned-contract validation gates.

## Non-goals

- Product-backlog items 5-6, including the new threshold-reached copy.
- Manager identity/tenant authorization (the next plan item).
- Contract Registry, `structuredContent`, or the later Python pipeline split.
- Secrets, provider configuration, deployment aliases, deployed writes, or a
  real-provider run.

## Acceptance criteria

- A run is durably enqueued and has an explicit lifecycle state.
- A worker can atomically lease due work; concurrent workers cannot own the
  same lease; heartbeat/lease expiry makes abandoned work recoverable.
- Automatic dispatch remains at-most-once for a round that already has a
  successful result; a manager rerun can create a new run.
- Successful and failed outcomes are persisted without relying on
  `aiInsightsUpdatedAt` as a claim marker.
- A duplicate or superseded callback is safe and does not overwrite a newer
  run/result.
- API/UI consumers use `queued` / `running` / `succeeded` / `failed` states.
- Reset removes the result and invalidates pending/in-flight analysis work.
- A3 job/latency/failure metrics have an explicit, test-covered collection
  boundary without respondent identity or detailed results in labels/logs.
- Relevant unit, API/contract and PostgreSQL integration tests pass; the full
  repository verification is run before completion is claimed.

## Relevant repository instructions

- `.agents/skills/shalomut-tracker/SKILL.md`
- `.agents/skills/shalomut-map/SKILL.md`
- `.agents/skills/shalomut-verification/SKILL.md` before completion claims

## Relevant architecture and contracts

- `docs/source-of-truth.md`
- `PROJECT_CONTEXT.md` ADR-001, ADR-002, ADR-003, ADR-006 and ADR-007
- `docs/ai-analytics-handoff.md`
- `contracts/ai-analytics-v1.json`
- `ai-analytics-service/README.md`

## Decisions made

- Treat `docs/wellbeing-refactoring-plan-v4-review.md` as the only source of
  truth for the refactoring plan; do not use the source PDFs.
- Keep this as a separate implementation branch from `cb8bed3`.
- Use a PostgreSQL partial unique index for one `queued`/`running` run per
  round, a stable `automatic` request key, and unique manual request keys.
- Lease work for 90 seconds, renew by heartbeat, and fail abandoned work after
  three attempts. Completion requires a live matching lease.
- Treat `AiAnalysisRun.result` as the durable read source and keep
  `SurveyRound.aiInsights` as a temporary dual-read/dual-write rollback path.
- Send durable callback identity in headers, not URL query parameters. Core
  still accepts the query pair during the consumer-first rollback window.
- Expose A3 metrics through bounded structured operational logs. Labels contain
  version/violation/trigger/failure codes and run/round correlation only, never
  respondent identity, answers, callback payloads or lease tokens.
- Keep Python polling behind `AI_JOB_POLLING_ENABLED` so Core routes and the
  migration can deploy before the worker starts claiming jobs.

## Assumptions

- The current `next-env.d.ts` change is pre-existing generated churn and must
  not be folded into the implementation.
- Local/test database contents are disposable, but writes must still target an
  explicitly identified database.

## Completed

- Recovered the branch and cross-branch handoff state.
- Confirmed the branch exists at the intended base commit.
- Read the accepted review plan and required project skills/context.
- Added `AiAnalysisRun`, its migration, in-memory and Prisma repositories, and
  a database-enforced one-active-run invariant.
- Replaced the timestamp claim with enqueue, atomic claim, heartbeat, lease
  recovery, bounded attempts, terminal persistence and reset invalidation.
- Changed automatic threshold processing and manager refresh to commit durable
  jobs without waiting for or contacting the provider.
- Added authenticated Core claim/heartbeat/failure routes and the Python
  polling worker lifecycle.
- Bound callbacks to run/lease identity, rejected expired/superseded/foreign
  ownership, and made identical result retries idempotent while rejecting a
  different payload under the completed token.
- Updated API/client lifecycle states to `queued`, `running`, `succeeded` and
  `failed`; retained legacy result reads and callback compatibility.
- Added and instrumented the complete A3 metric vocabulary.
- Updated OpenAPI JSON/YAML, `docs/source-of-truth.md`, `PROJECT_CONTEXT.md`,
  environment examples, local startup, Render config and the Python README.
- Ran full local verification and the real PostgreSQL concurrency suite against
  the isolated `shalomut_ai_jobs_test` database.

## In progress

- No implementation work remains. The complete diff is unstaged and awaits
  owner review plus the 2-3 commit split required by the accepted review.

## Remaining

- Push the branch to origin.
- Deploy (requires owner coordination for migration and poller capacity).

## Changed files

- Committed: locally split into three commits (persistence/lifecycle, Core API+metrics, Python worker+documentation).
- Staged: none.
- Unstaged: none.
- Untracked: none.
- Branch has no upstream. Visible only in this worktree; nothing has been pushed.

## Verification evidence

### Passed

- `npm run verify` — exit 0 after the final callback-header change:
  typecheck passed; TypeScript 286 tests / 285 passed / 1 PostgreSQL test
  skipped without `TEST_DATABASE_URL`; ESLint passed; production Next build
  passed; Python 274/274 passed. The only warning is the existing Starlette
  `TestClient`/`httpx` deprecation warning.
- `TEST_DATABASE_URL=postgresql://shalomut:shalomut@127.0.0.1:5433/shalomut_ai_jobs_test node --import tsx --test src/lib/repositories/__tests__/prisma-ai-analysis-runs.integration.test.ts`
  — exit 0, real PostgreSQL concurrent enqueue/claim and idempotent/stale
  completion passed.
- `DIRECT_URL=postgresql://shalomut:shalomut@127.0.0.1:5433/shalomut_ai_jobs_test npx prisma migrate deploy`
  — all six migrations applied to the isolated test database.
- `DIRECT_URL=postgresql://shalomut:shalomut@127.0.0.1:5433/shalomut_ai_jobs_test npx prisma migrate status`
  — exit 0, schema up to date.
- `npx prisma validate` and Prisma generation through the build — passed.
- OpenAPI integrity tests plus direct JSON/YAML parse — passed; both specs
  document the durable lifecycle, worker auth and header-based callback lease.
- `git diff --check` — passed before the final task-file update and is repeated
  after it.

### Failed

- None remaining. Expected red tests first exposed expired-lease completion,
  foreign-round callback mutation and callback identity in the URL; all are
  now green. An intermediate typecheck failure on union `failureReason` was
  fixed with an explicit type guard and the full typecheck was repeated.

### Blocked or not run

- No browser smoke: no layout or copy scope changed; API/client state behavior
  is covered by unit and integration tests.
- No deployed migration, preview/staging run, real-provider call, secrets,
  alias or external observability backend mutation; these are outside the
  authorized local implementation scope.

### Environment

- Local worktree and local `.venv`; Next build read existing local env files.
- Persistence evidence used only the disposable PostgreSQL database
  `shalomut_ai_jobs_test` in local container `shalomut-local-db` on port 5433.
  Working local and deployed databases were not migrated or written.
- Branch has no upstream; current HEAD remains `cb8bed3` (`origin/main` in
  locally available refs).

### Residual risk

- A process-local poller needs always-available compute. Render free web
  services and Cloud Run scale-to-zero do not guarantee polling while asleep;
  deployed rollout needs an always-on worker or an explicit scheduler/wake
  mechanism. This is documented and no deployed rollout was attempted.
- Structured metrics currently terminate at the safe JSON log boundary. An
  external collector/dashboard and alerts are deployment/operations work, not
  part of this local PR.
- The consumer-first order is migration + Core routes first, then Python with
  polling enabled. Legacy result reads/writes, query callback identity and the
  webhook remain rollback boundaries during that order.

## Failed approaches

- Started locating the source v4 PDF, then stopped when the owner clarified
  that the accepted review Markdown is now the plan source of truth.
- The first callback implementation put run/lease identity in query parameters.
  Final diff sends them in headers to keep the capability token out of access
  log URLs; Core retains query parsing only for rollback compatibility.

## Known risks

- Callback compatibility during migration: legacy callbacks have no run ID,
  so Core still accepts the old path and dual-writes the legacy result.
- Multiple app instances require database atomicity. This is covered by the
  PostgreSQL partial unique index and conditional update test; the in-memory
  repository remains only local/test fallback.
- `next build` may rewrite `next-env.d.ts`; its unrelated diff must remain out
  of task commits.

## Approval gates

- No gate for local schema migration/test database reset.
- Explicit bounded approval is required before secrets/auth configuration,
  deployment-alias changes or deployed writes; none are in scope.

## Questions requiring an owner decision

- None currently. The default contract-version question from the cross-task
  handoff belongs to PR 2.5 and does not block PR 3.

## Next concrete step

Push the branch and review deployment strategy for worker capacity.
