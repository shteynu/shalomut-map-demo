# Re-arm the automatic AI analysis path after a stale-input failure

## Metadata

- Branch: `fix/automatic-analysis-rearm`
- Base branch: `main`
- Base commit: `8bd8efa`
- Current HEAD: `10bae75` plus this docs commit
- Status: ready for review and push
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Stop one late respondent from permanently removing a round's automatic AI
analysis. Today the automatic path enqueues at most one run per round, ever, and
a run that fails because responses moved under it is terminal.

## User-visible outcome

A school whose eleventh response lands while the analysis of the first ten is
still running eventually gets a Stone Map instead of an empty dashboard that
nobody is told about. No manager action is required.

## Context

Found while reviewing `~/Downloads/ai-harness-improvement-plan.md`, whose Phase 1
("immutable input snapshot") names the same defect but describes it as a
correctness improvement rather than a live failure. The exact chain, verified
against `8bd8efa`:

1. `enqueueAiAnalyticsAfterResponse` fires on the submission that crosses the
   privacy threshold, with the constant `requestKey: 'automatic'`
   (`src/lib/server/trigger-ai-analytics.ts:38`). The round keeps accepting
   responses while the run works.
2. A run issues roughly two dozen provider calls (eight dimension
   interpretations, eight metric narratives, the overall summary, intervention
   adaptation — `ai-analytics-service/src/agents/psychologist_node.py:133`), so
   it lasts minutes, not seconds.
3. The callback is verified against analytics recalculated from the *current*
   responses (`src/lib/server/ai-insights-service.ts:137`).
   `verify-ai-result.ts:96` compares `metric.responseCount` against that
   recalculation, so ten-versus-eleven fails with `round_validation_failed`.
   Deployed contract `6.0` has `supportsDynamicQuestions: true`, so this full
   comparison is the deployed path.
4. `finish({state:'failed'})` is terminal: `claimNext` only considers `queued`
   runs and `running` runs with an expired lease.
5. Every later submission calls `enqueue` with `'automatic'`, hits
   `@@unique([roundId, requestKey])` and gets `duplicate`.

Only `POST /api/rounds/{roundId}/trigger-ai` recovers the round, because it uses
`manual:<uuid>`. That is a manager action nobody is prompted to take.

## Scope

- A bounded re-arm of the automatic path when, and only when, the previous
  automatic run failed with a code a fresh input could fix.
- `IAiAnalysisRunRepository.findByRoundId` so the policy can see the round's run
  history instead of guessing from the latest run.
- An operational metric for re-arms, because its rate is the measurement that
  says how urgently the plan's Phase 1 is needed.

## Non-goals

- The immutable input snapshot itself (plan Phase 1). This slice reduces the
  blast radius; it does not remove the race.
- Durable callback delivery (plan Phase 7).
- Any change to contract `1.0`–`6.0` wire semantics.
- Locking a round against new responses while a run is in flight.

## Acceptance criteria

- A round whose automatic run failed with `round_validation_failed` enqueues a
  fresh automatic run on the next submission.
- A round whose automatic run failed for any other reason does not.
- Re-arming stops at a fixed cap, so a steady stream of responses cannot spend
  provider quota without bound.
- A succeeded run of either trigger stops the automatic path.
- An active run of either trigger stops the automatic path.
- The failed run stays in the table as evidence; nothing rewrites terminal state.
- `npm run verify:core` passes; the repository change is covered on both the
  in-memory and the PostgreSQL repository.

## Relevant repository instructions

- `AGENTS.md` branch-scoped task state and mandatory progress handoff.
- `.agents/skills/shalomut-map/SKILL.md`: keep the Core/AI boundary, fail closed,
  do not change published contract semantics.
- `.agents/skills/shalomut-verification/SKILL.md` for the proof appropriate to
  this diff.

## Relevant architecture and contracts

- No wire contract changes. No Prisma schema change: the re-arm uses new request
  key values in the existing column.
- No API surface change; `POST /api/survey/{shareCode}/submit` already discards
  the enqueue outcome.

## Decisions made

- **New run rows, not a reset of the failed one.** The failed run stays as
  evidence, terminal state is never rewritten, and `findLatestByRoundId` keeps
  pointing at the newest attempt. Keys are `automatic`, then `automatic:2`,
  `automatic:3`, so concurrent submissions still collapse on the unique
  constraint.
- **Re-arm only on `round_validation_failed`.** `contract_validation_failed`,
  `analysis_validation_failed` and `lease_exhausted` describe the model, the
  payload or the worker, and a fresh input would not change them. Retrying them
  would spend money to fail identically.

## Assumptions

- Three automatic runs per round is a safe cap at the design stage: enough to
  outlast a normal submission burst, small enough that a pathological round
  cannot drain provider quota.

## Completed

- `IAiAnalysisRunRepository.findByRoundId` on the interface, the in-memory
  repository and the Prisma repository, ordered oldest first.
- The re-arm policy in `enqueueAiAnalyticsAfterResponse`, with two new outcomes
  `not_retryable` and `retries_exhausted`, and the numbered request key.
- `ai_jobs_rearmed` in the operational metric sink, labelled with the attempt
  number and the failure code that caused it.
- Ten unit tests for the policy and one PostgreSQL integration test for the
  numbered key against the real partial unique index.
- `PROJECT_CONTEXT.md` ADR-016 and the operational note in
  `docs/shalomut-tracker-handoff.md`.

## In progress

None.

## Remaining

Nothing in scope. The push is the owner's: the agent cannot push here.

## Changed files

- `src/lib/repositories/interfaces.ts`
- `src/lib/repositories/in-memory/in-memory-ai-analysis-run.repository.ts`
- `src/lib/repositories/prisma/prisma-ai-analysis-run.repository.ts`
- `src/lib/server/trigger-ai-analytics.ts`
- `src/lib/server/ai-operational-metrics.ts`
- `src/lib/server/__tests__/trigger-ai-analytics.test.ts` (new)
- `src/lib/repositories/__dbtests__/prisma-ai-analysis-runs.integration.test.ts`
- `PROJECT_CONTEXT.md`, `docs/shalomut-tracker-handoff.md`, this file

## Verification evidence

### Passed

- `npm run verify:core`, exit code 0: 541 TypeScript tests, both fitness checks
  (5 + 5), `next typegen && tsc --noEmit`, ESLint and the production build.
- `npm run verify:db`, 20 PostgreSQL tests, 0 failed, 0 skipped — 19 before this
  slice plus the new re-arm test.

### Failed

None.

### Blocked or not run

- `npm run verify:ai` was not run. No file under `ai-analytics-service/`
  changed, no contract manifest changed and no wire semantics moved, so the
  verification matrix does not call for it.
- No browser smoke. The change has no UI surface, and reproducing it in a
  browser would need ten responses plus a provider run that loses a race.
- The end-to-end re-arm has not been observed against a real provider. What is
  proven is the enqueue policy and the durable-run behaviour around it.

### Environment

Local, plus the local PostgreSQL used by `verify:db`. Nothing deployed was
touched or read.

### Residual risk

- The race itself is untouched. A round can still burn all three automatic runs
  if responses keep arriving, and then it needs the manual trigger exactly as
  before. This slice bounds the damage; plan Phase 1 removes the cause.
- The cap is a guess, not a measurement. `ai_jobs_rearmed` exists so the next
  decision about it can be made from data.

## Failed approaches

- Added a read-then-insert active-run guard to the Prisma `enqueue`, on the
  belief that the `(round_id, request_key)` unique key was the only thing
  keeping one run in flight and that a numbered key would slip past it. It was
  redundant: migration `20260730150000_add_ai_analysis_runs` already creates the
  partial unique index `ai_analysis_runs_one_active_per_round_key` on
  `round_id WHERE state IN ('queued','running')`, and the existing integration
  test passes with the guard removed. Reverted, leaving only a comment that
  names the index. Checked by stashing the change and re-running `verify:db`.

## Known risks

- Two concurrent submissions can compute the same numbered key; the unique
  constraint collapses them, which the integration test exercises for the
  sequential case and the pre-existing concurrency test covers for the index.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment alias
is touched.

## Questions requiring an owner decision

None open.

## Next concrete step

Hand the push to the owner: `git push origin fix/automatic-analysis-rearm:main`.
