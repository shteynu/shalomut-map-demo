/**
 * A callback that could not store its result says so, and undoes the half it
 * did.
 *
 * Two defects from the 2026-08-21 audit, one seam. The durable run was closed
 * and the round's legacy column written as two separate writes, so a failure
 * between them left the two stores disagreeing about the same paid analysis.
 * And a failed column write was reported as `round_not_found` — a `404`, which
 * `result_sink.py` treats as a verdict about the payload and stops retrying on
 * (`CallbackDeliveryError.transient`). A dropped connection therefore threw
 * away an analysis that was correct and had been paid for.
 *
 * What this file can prove is the reporting and the ordering. That the rows
 * actually roll back is a question for a database, and
 * `__dbtests__/postgres-ai-callback-atomicity.test.ts` asks PostgreSQL it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import {
  applyAiInsightsCallback,
  type AiCallbackWriteStores,
} from '../ai-insights-service';
import type { SurveyRound } from '@/lib/types/backend';

const ROUND_ID = 'round-atomic-callback';

const round: SurveyRound = {
  id: ROUND_ID,
  organizationId: 'org-1',
  title: 'סבב בדיקה',
  status: 'closed',
  shareCode: 'SHALOM-ATOMIC',
  privacyThreshold: 10,
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

/** Contract 1.0: no definition hash, no round verification, a real result. */
const LOCKED_RESULT = {
  contractVersion: '1.0',
  roundId: ROUND_ID,
  isLocked: true,
  status: 'locked_error',
  errorMessage: 'Privacy lock active',
};

function repositories() {
  const roundRepo = new InMemoryRoundRepository([round]);
  return {
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(roundRepo),
    roundRepo,
    surveyRepo: new InMemorySurveyRepository(),
  };
}

/**
 * A leased run in `running`, which is the only state `finish` transitions from.
 * Returned with its token because the callback is refused without the pair.
 */
async function leasedRun(repos: ReturnType<typeof repositories>) {
  const { run } = await repos.aiAnalysisRunRepo.enqueue(ROUND_ID, {
    requestKey: `manual:${Math.random()}`,
    trigger: 'manual',
  });
  const claimed = await repos.aiAnalysisRunRepo.claimNext({
    workerId: 'worker-under-test',
    leaseMs: 600_000,
  });
  assert.equal(claimed?.run.id, run.id);
  return { runId: claimed!.run.id, leaseToken: claimed!.leaseToken };
}

/** The store set the writes see, with the column write refused. */
function refusingTheColumn(
  repos: ReturnType<typeof repositories>,
): AiCallbackWriteStores {
  return {
    aiAnalysisRunRepo: repos.aiAnalysisRunRepo,
    // Delegating rather than spreading: the in-memory repository is a class, so
    // a spread copies its fields and leaves its methods behind.
    aiInsightsRepo: {
      save: async () => false,
      findByRoundId: (roundId: string) =>
        repos.aiInsightsRepo.findByRoundId(roundId),
      deleteByRoundId: (roundId: string) =>
        repos.aiInsightsRepo.deleteByRoundId(roundId),
    },
  };
}

test('a column write that fails is a write failure, not a missing round', async () => {
  const repos = repositories();
  const identity = await leasedRun(repos);

  const outcome = await applyAiInsightsCallback(
    ROUND_ID,
    identity,
    LOCKED_RESULT,
    repos,
    (work) => work(refusingTheColumn(repos)),
  );

  // The whole point. `round_not_found` here would answer 404 and the worker
  // would stop; `write_failed` answers 500 and it tries again.
  assert.equal(outcome.outcome, 'write_failed');
});

test('a round that really is missing is still a missing round', async () => {
  // The negative control for the test above: the distinction only means
  // something if the genuine 404 survives it. It comes from the read at the top
  // of the callback, which is the place that actually knows.
  const repos = repositories();

  const outcome = await applyAiInsightsCallback(
    'round-that-never-existed',
    { runId: null, leaseToken: null },
    { ...LOCKED_RESULT, roundId: 'round-that-never-existed' },
    repos,
  );

  assert.equal(outcome.outcome, 'round_not_found');
});

test('without a transaction the two stores do diverge, which is why one exists', async () => {
  // The negative control, and the reason this file cannot prove the fix. A
  // `Map` mutated by one process has nothing to roll back: `finish` has already
  // written when the column refuses, so the run says `succeeded` beside a round
  // still holding the previous map. That is the exact divergence the audit
  // named, reproduced here on purpose.
  //
  // `__dbtests__/postgres-ai-callback-atomicity.test.ts` runs the same callback
  // through `runInTransaction` against PostgreSQL and asserts the opposite.
  const repos = repositories();
  const identity = await leasedRun(repos);

  const outcome = await applyAiInsightsCallback(
    ROUND_ID,
    identity,
    LOCKED_RESULT,
    repos,
    (work) => work(refusingTheColumn(repos)),
  );

  assert.equal(outcome.outcome, 'write_failed');
  assert.equal(
    (await repos.aiAnalysisRunRepo.findById(identity.runId))?.state,
    'succeeded',
  );
  assert.equal(await repos.aiInsightsRepo.findByRoundId(ROUND_ID), null);
});

test('the writes still succeed together when nothing refuses them', async () => {
  // Without this the three tests above would pass on a callback that had
  // stopped working entirely.
  const repos = repositories();
  const identity = await leasedRun(repos);

  const outcome = await applyAiInsightsCallback(
    ROUND_ID,
    identity,
    LOCKED_RESULT,
    repos,
  );

  assert.equal(outcome.outcome, 'persisted');
  assert.equal((await repos.aiAnalysisRunRepo.findById(identity.runId))?.state, 'succeeded');
  assert.ok(await repos.aiInsightsRepo.findByRoundId(ROUND_ID));
});

test('a verdict about the callback is reported, not thrown', async () => {
  // `run_not_found` and `lease_stale` are answers about this analysis, and the
  // worker knows how to stop on them. They travel out of the write block as
  // results rather than as the retriable failure above, and nothing was written
  // by the time they are decided.
  const repos = repositories();
  const identity = await leasedRun(repos);

  const stale = await applyAiInsightsCallback(
    ROUND_ID,
    { runId: identity.runId, leaseToken: 'a-token-from-an-older-lease' },
    LOCKED_RESULT,
    repos,
  );
  assert.equal(stale.outcome, 'lease_stale');

  const unknown = await applyAiInsightsCallback(
    ROUND_ID,
    { runId: 'run-that-never-existed', leaseToken: identity.leaseToken },
    LOCKED_RESULT,
    repos,
  );
  assert.equal(unknown.outcome, 'run_not_found');
});
