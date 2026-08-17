# Analysis runs when a round closes, not after every answer

## Metadata

- Branch: `refactor/analysis-runs-when-a-round-closes`
- Base branch: `main`
- Base commit: `8231490` (`origin/main`)
- Current HEAD: `8231490` plus one documentation commit on this branch
- Status: opened, scoped, not started
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make AI analysis run on an explicit trigger instead of automatically after each
respondent submission, and move the privacy-threshold check that the automatic
path currently owns onto whatever path survives.

## User-visible outcome

A manager stops seeing analysis appear and re-appear while a round is still
collecting, and starts getting one analysis for the round they closed. The
screen stops promising that analysis begins by itself.

## Context

Owner decision 4 of 2026-08-17, recorded in
[`response-quality-research-2026-08-17.md`](../../response-quality-research-2026-08-17.md)
§9 and scoped as task A of
[`response-quality-plan-2026-08-17.md`](../../response-quality-plan-2026-08-17.md).
Accepted as a separate task precisely so it does not wait on the
response-quality feature, which it does not depend on.

## Scope

- Remove the automatic dispatch after a respondent submission.
- Re-home the four things that dispatch silently carries (below).
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
  removed.
- No test passes while asserting a screen string that is no longer true.
- No fully tested but unreachable module is left behind.
- `npm run verify:core` passes.

## Relevant repository instructions

- `AGENTS.md` — privacy is a product invariant, not an environment gate.
- `.agents/skills/shalomut-map/SKILL.md` — published contracts `1.0`–`6.0` keep
  their semantics; `resolveCoreRepositories` is for entrypoints only.
- `.agents/skills/shalomut-verification/SKILL.md` — before claiming completion.

## Relevant architecture and contracts

- `enqueueAiAnalyticsAfterResponse` is called from exactly one place,
  `src/app/api/survey/[shareCode]/submit/route.ts:10` and its use below.
- `AiAnalysisRun` carries `@@unique([roundId, requestKey])` plus a partial unique
  index keeping one run per round in flight while `state` is `queued` or
  `running`.
- ADR-016 exists because a round accepted responses while a run was working;
  that premise weakens once analysis follows closing, but does not vanish (see
  Known risks).

## Decisions made

None yet beyond the owner decision to do this. The four items below are findings,
not choices.

## Assumptions

- The explicit trigger is the manager's, on a closed round. Whether it is the
  existing `POST /api/rounds/[roundId]/trigger-ai` or a new
  close-and-analyse action is open, and is the first thing to settle.

## Completed

Nothing implemented. The scoping below was measured rather than estimated.

## In progress

Nothing.

## Remaining

Four things the removal takes with it, each of which must be re-homed:

1. **The only server-side privacy-threshold check before dispatch.**
   `effectivePrivacyThreshold` is verified at
   `src/lib/server/trigger-ai-analytics.ts:81-84` and nowhere else on any
   dispatch path. `POST /api/rounds/[roundId]/trigger-ai` checks authorization
   and the archived guard, and does not check the threshold at all; the
   remaining protection is the `disabled` attribute at
   `src/components/round/round-controls.tsx:262`. **This is the load-bearing
   item.** Without it, ADR-005 rests on client-side markup.
2. **The `already_generated` guard**, which prevents a stored result being
   regenerated, lives in the same function.
3. **The `ai_jobs_rearmed` metric.**
   `docs/shalomut-tracker-handoff.md:1466-1473` names its frequency as the
   evidence for an owner-held decision about an immutable input snapshot.
   Decide explicitly: declare the measurement finished and record that, or
   replace the counter. A counter that silently stops emitting is the worst
   outcome. `ai_jobs_queued{trigger="automatic"}` also goes to zero, which makes
   any query grouped on that label lie rather than break.
4. **Three screen strings that become false while their tests stay green.**
   `src/components/round/round-threshold-next-step.tsx:51, 72, 88` promise that
   analysis starts automatically at the threshold and that closing the round is
   unnecessary. Their assertions at
   `round-threshold-next-step.test.tsx:50, 68, 77` pass after the change. Copy
   and assertions move in the same commit as the code.

Then:

- `AI_ANALYSIS_AUTOMATIC_MAX_RUNS = 3` loses its subject — it capped a
  self-feeding loop that no longer exists. What remains as the guard is the
  partial unique index. Separately, `manual:<uuid>` is unbounded today; if the
  manual path becomes the main entrance, a ceiling belongs there.
- Delete `src/lib/server/trigger-ai-analytics.ts` with its test rather than
  leave a fully tested unreachable module; the third test in
  `submit-auto-trigger.test.ts` becomes a tautology.
- Introduce a state meaning "analysis appears once the round is closed" rather
  than reusing not-found, which must keep meaning an anomaly. Direct-run buttons
  on an active round (`dashboard-ai-insights-state.tsx`, and
  `round-controls.tsx` `refresh-round-analysis`) either move or go, otherwise
  "one entrance" is false.
- Documents: `PROJECT_CONTEXT.md` ADR-016 and ADR-006,
  `docs/source-of-truth.md` §AI Analysis Triggering,
  `docs/ai-analytics-handoff.md`, `docs/openapi.yaml` followed by
  `npm run openapi:generate`, `docs/shalomut-tracker-handoff.md:1466-1473`, and
  `docs/dashboard-semantic-contract.md` if the set of empty states changes.
  Archived task files stay as they are.

## Changed files

- `docs/agent-tasks/active/refactor--analysis-runs-when-a-round-closes.md`
  (new, this file)

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch and is not part of this task.

## Verification evidence

### Passed

None for this branch yet.

### Failed

None.

### Blocked or not run

The full suite has not been run on this branch. It **was** run during research,
on a throwaway edit that was reverted: removing the
`enqueueAiAnalyticsAfterResponse` block from the submit route gave **2 failures
out of 1080 tests**, with `tsc --noEmit` and `eslint` clean and e2e untouched.
Both failures were in one file and both were about the removed behaviour. That
measurement scopes the mechanical part; it is not evidence about this branch,
which has no code change yet.

### Environment

Local worktree only. Nothing deployed, no database read or written.

### Residual risk

None yet — no code has changed.

## Failed approaches

None yet. Recorded from research: "it is enough to remove the call" is false,
and why is the Remaining section above.

## Known risks

- Re-arm loses its main cause but not all of it. `updateStatus` is an
  unconditional UPDATE outside any transaction with the enqueue
  (`prisma-round.repository.ts:156-169`), so a submission that read `active`
  before the PATCH can still land after it. Narrow window, same failure mode.
- `reset` is available on a closed round and deletes responses and runs
  together, so a callback can arrive for a run that no longer exists.
- Without the automatic path and without re-arm, one failed run leaves a round
  with no analysis and the only way back is a manual button. That is acceptable
  only if the button is reachable in that state.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment alias
is touched.

## Questions requiring an owner decision

- Is the explicit trigger the existing manual button on a closed round, or a
  new close-and-analyse action? Everything else follows from this.
- Should `ai_jobs_rearmed` be declared finished, or replaced?

## Agent recommendation

- Recommended role: `strong reasoning model`, and an `independent reviewer` for
  the commit that moves the privacy check.
- Reason: the load-bearing part of this task is a privacy invariant that has no
  server-side guard on the path that survives, so the diff is security-sensitive
  rather than mechanical.

## Next concrete step

Settle the first open question — existing manual trigger versus a new
close-and-analyse action — then write the privacy-threshold check into whichever
path is chosen, with a test that fails when the check is removed. Do that before
deleting anything, so the invariant is never briefly unguarded.
