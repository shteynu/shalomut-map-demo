# Analysis runs when a round closes, not after every answer

## Metadata

- Branch: `refactor/analysis-runs-when-a-round-closes`
- Base branch: `main`
- Base commit: `8231490` (`origin/main`)
- Current HEAD: `dd96ae0`, five commits ahead of `origin/main`, nothing pushed
- Status: implemented and verified locally; awaiting the owner's push
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make AI analysis run on an explicit trigger instead of automatically after each
respondent submission, and move the privacy-threshold check that the automatic
path currently owns onto whatever path survives.

## User-visible outcome

A manager stops seeing analysis appear and re-appear while a round is still
collecting, and gets one analysis for the round they closed. The screen stops
promising that analysis begins by itself.

## Context

Owner decision 4 of 2026-08-17, recorded in
[`response-quality-research-2026-08-17.md`](../../response-quality-research-2026-08-17.md)
§9 and scoped as task A of
[`response-quality-plan-2026-08-17.md`](../../response-quality-plan-2026-08-17.md).
Accepted as a separate task precisely so it does not wait on the
response-quality feature, which it does not depend on.

## Scope

- Remove the automatic dispatch after a respondent submission.
- Re-home the four things that dispatch silently carries.
- Update the screen copy that becomes false, together with its assertions.
- Update the documents that own the triggering rule.

## Non-goals

- No exclusion of responses and no quality report — those are tasks B and C of
  the same plan.
- No change to the AI contract, the payload or the Python service.
- No new round status. Whether closing gains a review step is a separate
  question and is not settled here.

## Acceptance criteria

- No server path can dispatch an analysis for a round below its effective
  privacy threshold, and this is covered by a test that fails if the check is
  removed. — **met**, and the failure was demonstrated rather than assumed
  (see Verification evidence).
- No test passes while asserting a screen string that is no longer true. —
  **met**; copy and assertions moved in the same commits.
- No fully tested but unreachable module is left behind. — **met**;
  `trigger-ai-analytics.ts` was repurposed rather than deleted, because closure
  still needs a dispatch function, and its test file was rewritten to match.
- `npm run verify:core` passes. — **met**.

## Decisions made

1. **The explicit trigger is closing the round, not the manual button.** The
   `PATCH /api/rounds/{roundId}` transition to `closed` dispatches; the manual
   `POST .../trigger-ai` became the second opinion for a round already closed.
   The first open question is therefore answered "both, with different jobs".
2. **The trigger enum gained `closure`** rather than reusing `manual`. A run
   started by a manager pressing refresh and a run started by closing are
   different facts, and `ai_jobs_queued{trigger=...}` is the only place that
   distinction survives. `automatic` is kept in the enum for rows already
   written; nothing produces it any more.
3. **`round_not_closed` is enforced at the route, not by disabling buttons.**
   Two screens offer the action and the route is reachable without either. The
   alternative — prop-drilling `isCollecting` through five dashboard components
   — would have put the same rule in two places with no way to keep them equal.
4. **`ai_jobs_rearmed` is removed, not left silent.** A counter that stays in
   the union and never increments reads as *zero occurrences* on a dashboard,
   which is the opposite of *no measurement*. The residual signal moved to
   `ai_jobs_failed{failureCode="round_validation_failed"}`.
5. **The `already_generated` guard is gone.** It stopped a round being analysed
   twice, which was right when every answer could ask. Closing is deliberate,
   `closed → closed` is not an allowed transition, and a school that reopened a
   round to collect more answers wants the analysis of what it has now.
6. **The dispatch follows the status write and cannot fail it.** A round the
   manager meant to close is closed even when nothing could be queued; the
   PATCH response reports which in an `analysis` field.

## Assumptions

- A reopened-and-reclosed round should be analysed again, on what it has then.
  The closure request key is numbered from the round's own history (`closure`,
  `closure:2`) so that this works and so two requests racing on one close
  collapse on `@@unique([roundId, requestKey])`.

## Completed

1. `f6eff06` — `src/lib/server/privacy-threshold-guard.ts`, applied to
   `POST /api/rounds/[roundId]/trigger-ai`. Written **before** anything was
   deleted, so the invariant was never briefly unguarded.
2. `c48fef6` — `enqueueAiAnalyticsAfterResponse` became
   `enqueueAiAnalyticsOnClosure`; the submit route dispatches nothing; the PATCH
   route dispatches on close; migration
   `20260817120000_analysis_may_be_triggered_by_closing_a_round` widens the
   `trigger` check constraint to include `closure`.
3. `015ad3f` — screen copy on `/round`, the `round_not_closed` route guard, the
   refresh button's `disabled` rule, and 409 handling that reads the body `code`
   on both screens instead of assuming "a run is already going".
4. `dd96ae0` — `ai_jobs_rearmed` removed with an explanation in its place;
   `PROJECT_CONTEXT.md` ADR-016 rewritten; `PROGRESS.md`,
   `docs/source-of-truth.md`, `docs/ai-analytics-handoff.md` and
   `docs/shalomut-tracker-handoff.md` updated; two stale strings in
   `dashboard-ai-insights-state.tsx` corrected.

`PROJECT_CONTEXT.md` ADR-006 was inspected and deliberately left alone: it
describes durable execution mechanics (lease, heartbeat, bounded attempts,
idempotent callback) that this change does not touch.
`docs/dashboard-semantic-contract.md` was inspected and needed nothing — the set
of empty states did not change, only the wording inside one of them.

## In progress

Nothing.

## Remaining

Nothing in scope. Out of scope but adjacent, in the order they matter:

- `manual:<uuid>` is unbounded. The old ceiling (`AI_ANALYSIS_AUTOMATIC_MAX_RUNS
  = 3`) capped a self-feeding loop that no longer exists, so removing it was
  right, but the manual path is now a real entrance and has no ceiling of its
  own. Each run costs roughly two dozen provider calls.
- Tasks B and C of the response-quality plan (the round-quality report, computed
  then shown) are untouched and independent of this branch.

## Changed files

Five commits, `origin/main..HEAD`, 28 files, +1318/−519. Nothing staged,
nothing untracked.

- New: `src/lib/server/privacy-threshold-guard.ts`,
  `src/app/api/__tests__/round-close-dispatches-analysis.test.ts`,
  `src/app/api/__tests__/submit-dispatches-no-analysis.test.ts`,
  `src/app/api/__tests__/trigger-ai-refusals.test.ts` (renamed from
  `trigger-ai-privacy-threshold.test.ts`), the migration, and this file.
- Deleted: `src/app/api/__tests__/submit-auto-trigger.test.ts`.
- Rewritten: `src/lib/server/trigger-ai-analytics.ts` and its test.
- Edited: the three routes, four components, `src/lib/repositories/interfaces.ts`,
  `src/lib/types/ai-analysis-run.ts`, `src/lib/server/ai-operational-metrics.ts`,
  `src/app/round/page.tsx`, `docs/openapi.yaml` with its generated
  `public/openapi.json`, and the five documents named under Completed.

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch, is not part of this task, and was deliberately left uncommitted.

## Verification evidence

### Passed

- `npm run verify:core`, exit 0, on `dd96ae0`: **1094 tests, 1094 pass, 0 fail**
  across 18 suites, plus typecheck, eslint, the production build and all eight
  lint gates (`literals`, `interpreter`, `composition`, `fixtures`, `skills`,
  `mutation-config`, `contract-refusals`, `fonts`).
- `npm run openapi:check` — the generated mirror matches `docs/openapi.yaml`.
- **The privacy guard was proved load-bearing, not assumed.** Deleting
  `getPrivacyThresholdGuardResponse` from the trigger-ai route made 4 of the 5
  new refusal tests fail; restoring it returned them to green. The deletion was
  reverted.
- `npx prisma migrate deploy` applied
  `20260817120000_analysis_may_be_triggered_by_closing_a_round` to the local
  database, and `pg_get_constraintdef` reads back
  `CHECK ((trigger = ANY (ARRAY['automatic'::text, 'manual'::text, 'closure'::text])))`.

### Failed

Three failures were met and fixed during the work; each was a real finding, not
noise:

- Removing the submit-route dispatch failed the 2 tests in
  `submit-auto-trigger.test.ts` that asserted it. Expected; the file was
  replaced by one asserting the absence.
- Adding the threshold guard failed 2 tests in `mcp-integration.test.ts`, which
  had been dispatching analyses for rounds holding **zero** responses. The
  fixtures now seed `MINIMUM_PRIVACY_THRESHOLD` responses.
- Adding the `round_not_closed` guard failed 2 more there, because the demo
  round was `active`. Both fixture rounds are now `closed`.

### Blocked or not run

- **Browser evidence: none.** No screen was walked in a signed-in session, so
  the Hebrew copy changes are verified by unit assertions on rendered markup
  only, not by looking at them.
- **e2e (Playwright): not run** on this branch. It is not part of
  `verify:core`, and no e2e spec touches the analysis trigger.
- **Deployed: nothing.** The migration is applied locally only. The deployed
  database was read to confirm it, not assumed: its constraint is still
  `CHECK ((trigger = ANY (ARRAY['automatic'::text, 'manual'::text])))` and its
  newest applied migration is `20260814120000_answers_may_have_no_dimension_or_score`,
  so it would reject a `closure` run. Applying the migration is part of whatever
  deploys this branch.
- **The database integration suite** (`__dbtests__`) was not run; it is not in
  `verify:core`. `prisma-ai-analysis-runs.integration.test.ts` still exercises
  `automatic:2` re-arm keys, which the constraint still permits, so it should
  pass — but that is reasoning, not a run.

### Environment

Local worktree, and the local database at `127.0.0.1:5433` for the migration
only. Nothing deployed. No provider call was made — no AI pipeline was run.

### Residual risk

- The window ADR-016 describes is narrower but not closed: `updateStatus` is not
  in a transaction with the dispatch, so a submission that read `active` can
  still land after the aggregates were read. It now shows up only as
  `ai_jobs_failed{failureCode="round_validation_failed"}`.
- A closed round whose single dispatch failed has exactly one way back — the
  manual button. Both screens that carry it were checked for reachability in the
  failed and not-found states, but by reading the components, not by walking
  them in a browser.
- Anything watching `ai_jobs_rearmed` or `ai_jobs_queued{trigger="automatic"}`
  now sees a metric that stopped rather than one that was retired. Both are
  named in `docs/shalomut-tracker-handoff.md`, which is where an operator would
  look.

## Failed approaches

- "It is enough to remove the call" — false, and the four re-homed items are
  why. Recorded from the research phase and confirmed by this implementation.
- Prop-drilling `isCollecting` to disable the analysis buttons was considered
  and rejected in favour of the route-level `round_not_closed` refusal. The
  screens now report what the route answered instead of predicting it.

## Known risks

- `reset` is available on a closed round and deletes responses and runs
  together, so a callback can still arrive for a run that no longer exists.
  Unchanged by this branch and out of its scope.
- The deployed database constraint lags this branch (see Blocked above). A
  deploy that ships the code without the migration turns every close into a
  `not_dispatched` outcome — visible, not silent, but wrong.

## Approval gates

- **Push is the owner's.** Five commits sit on the branch with no upstream. No
  secrets, credentials, authentication configuration or deployment alias was
  touched.

## Questions requiring an owner decision

- Should the manual `POST .../trigger-ai` path gain a ceiling now that it is a
  real entrance rather than an exception? Each run is roughly two dozen provider
  calls and `manual:<uuid>` is unbounded.
- Does closing a round need a confirmation step, given that it now spends
  provider quota as a side effect? This branch deliberately did not add one.

## Agent recommendation

- Recommended role: `strong reasoning model` for tasks B and C; this task is
  done.
- Reason kept for the record: the load-bearing part was a privacy invariant with
  no server-side guard on the surviving path, which made the diff
  security-sensitive rather than mechanical.

## Next concrete step

Hand the push over to the owner:

```bash
git push origin refactor/analysis-runs-when-a-round-closes
```

Then, before or with the deploy that carries it, apply
`20260817120000_analysis_may_be_triggered_by_closing_a_round` to the deployed
database — without it, closing a round fails its constraint and reports
`not_dispatched`.
