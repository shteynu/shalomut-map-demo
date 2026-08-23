/**
 * What closing a round dispatches, and what it refuses.
 *
 * This suite replaces the one that tested `enqueueAiAnalyticsAfterResponse`.
 * Most of what it asserted — a re-arm on `round_validation_failed`, a ceiling of
 * three automatic runs, a succeeded run closing the path — described machinery
 * that only existed because the dispatch fired on every respondent submission.
 * Owner decision 2026-08-17 moved it to the moment a manager closes the round,
 * and those assertions are not weakened here, they are about behaviour that no
 * longer exists.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryAiAnalysisRunRepository } from '@/lib/repositories';
import type { ISurveyRepository } from '@/lib/repositories/interfaces';
import type { OperationalMetric } from '../ai-operational-metrics';
import { setOperationalMetricSinkForTests } from '../ai-operational-metrics';
import { enqueueAiAnalyticsOnClosure } from '../trigger-ai-analytics';

const THRESHOLD = 10;

/**
 * The dispatch asks the survey repository exactly one question, so the stub
 * answers exactly that one. A fuller fake would only hide which fact the
 * decision actually rests on.
 */
function surveyRepoWith(responseCount: number): ISurveyRepository {
  return {
    getResponseCount: async () => responseCount,
  } as unknown as ISurveyRepository;
}

interface Harness {
  aiAnalysisRunRepo: InMemoryAiAnalysisRunRepository;
  close: (responseCount?: number) => Promise<string>;
}

function harness(roundId: string): Harness {
  const aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  return {
    aiAnalysisRunRepo,
    close: (responseCount = THRESHOLD) =>
      enqueueAiAnalyticsOnClosure(
        roundId,
        THRESHOLD,
        aiAnalysisRunRepo,
        surveyRepoWith(responseCount),
      ),
  };
}

/** Claims whatever is queued and ends it, the way a callback would. */
async function finishQueuedRun(
  repo: InMemoryAiAnalysisRunRepository,
  outcome: { state: 'succeeded' } | { state: 'failed'; failureCode: string },
): Promise<void> {
  const lease = await repo.claimNext({ leaseMs: 60_000, workerId: 'worker-1' });
  assert.ok(lease, 'expected a queued run to claim');
  const finished =
    outcome.state === 'succeeded'
      ? await repo.finish(lease.run.id, {
          state: 'succeeded',
          leaseToken: lease.leaseToken,
          result: { contractVersion: '6.0', status: 'success' },
        })
      : await repo.finish(lease.run.id, {
          state: 'failed',
          leaseToken: lease.leaseToken,
          failureCode: outcome.failureCode,
        });
  assert.equal(finished, 'transitioned');
}

test('below the privacy threshold closing dispatches nothing', async () => {
  const { close, aiAnalysisRunRepo } = harness('round-closure-1');

  assert.equal(await close(THRESHOLD - 1), 'below_threshold');
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId('round-closure-1'), []);
});

test('closing a round above the threshold dispatches its first run', async () => {
  const { close, aiAnalysisRunRepo } = harness('round-closure-2');

  assert.equal(await close(), 'enqueued');

  const runs = await aiAnalysisRunRepo.findByRoundId('round-closure-2');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].requestKey, 'closure');
  assert.equal(runs[0].trigger, 'closure');
});

test('two requests racing on one close collapse instead of queueing twice', async () => {
  const { close, aiAnalysisRunRepo } = harness('round-closure-3');

  const [first, second] = await Promise.all([close(), close()]);

  assert.ok(
    [first, second].includes('enqueued'),
    'one of the two must have queued the run',
  );
  assert.ok(
    [first, second].some((outcome) => outcome !== 'enqueued'),
    'the other must have been refused rather than queued a second run',
  );
  assert.equal(
    (await aiAnalysisRunRepo.findByRoundId('round-closure-3')).length,
    1,
  );
});

test('a run still in flight is not joined by a second one', async () => {
  const { close, aiAnalysisRunRepo } = harness('round-closure-4');
  assert.equal(await close(), 'enqueued');

  assert.equal(await close(THRESHOLD + 1), 'already_active');
  assert.equal(
    (await aiAnalysisRunRepo.findByRoundId('round-closure-4')).length,
    1,
  );
});

test('a round reopened and closed again is analysed again, on what it has now', async () => {
  // The old automatic path refused this as `already_generated`, which was right
  // when every answer could ask for a run. Closing is a deliberate act, and a
  // school reopens a round precisely because the first analysis was of fewer
  // answers than it now has.
  const { close, aiAnalysisRunRepo } = harness('round-closure-5');
  assert.equal(await close(), 'enqueued');
  await finishQueuedRun(aiAnalysisRunRepo, { state: 'succeeded' });

  assert.equal(await close(THRESHOLD + 4), 'enqueued');

  const runs = await aiAnalysisRunRepo.findByRoundId('round-closure-5');
  assert.equal(runs.length, 2);
  assert.equal(runs[0].state, 'succeeded');
  assert.equal(runs[1].requestKey, 'closure:2');
  assert.equal(runs[1].state, 'queued');
});

test('a failed run does not leave the round unable to be analysed again', async () => {
  const { close, aiAnalysisRunRepo } = harness('round-closure-6');
  await close();
  await finishQueuedRun(aiAnalysisRunRepo, {
    state: 'failed',
    failureCode: 'provider_unavailable_missing_api_key',
  });

  assert.equal(await close(), 'enqueued');
  assert.equal(
    (await aiAnalysisRunRepo.findByRoundId('round-closure-6')).length,
    2,
  );
});

test('the manual re-analysis button does not consume a closure key', async () => {
  const { close, aiAnalysisRunRepo } = harness('round-closure-7');
  await close();
  await finishQueuedRun(aiAnalysisRunRepo, { state: 'succeeded' });
  await aiAnalysisRunRepo.enqueue('round-closure-7', {
    requestKey: 'manual:once',
    trigger: 'manual',
  });
  await finishQueuedRun(aiAnalysisRunRepo, { state: 'succeeded' });

  assert.equal(await close(), 'enqueued');

  const runs = await aiAnalysisRunRepo.findByRoundId('round-closure-7');
  assert.equal(runs[runs.length - 1].requestKey, 'closure:2');
});

test('a dispatched run is counted so the queue rate stays readable', async () => {
  const metrics: OperationalMetric[] = [];
  setOperationalMetricSinkForTests((metric) => metrics.push(metric));
  try {
    await harness('round-closure-8').close();

    const queued = metrics.filter((metric) => metric.name === 'ai_jobs_queued');
    assert.equal(queued.length, 1);
    assert.equal(queued[0].labels?.trigger, 'closure');
    assert.equal(queued[0].roundId, 'round-closure-8');
  } finally {
    setOperationalMetricSinkForTests(null);
  }
});

test('a refusal below the threshold is not counted as a queued job', async () => {
  const metrics: OperationalMetric[] = [];
  setOperationalMetricSinkForTests((metric) => metrics.push(metric));
  try {
    await harness('round-closure-9').close(THRESHOLD - 1);
    assert.equal(
      metrics.some((metric) => metric.name === 'ai_jobs_queued'),
      false,
    );
  } finally {
    setOperationalMetricSinkForTests(null);
  }
});

/**
 * A repository that answers exactly as before and says which methods were asked.
 *
 * Counting calls rather than timing them: the defect here is not that the load
 * was slow on three rows, it is that the dispatch asked for rows at all, and
 * only a caller-level assertion can hold that once the numbers agree.
 */
function counting<T extends object>(target: T): [T, Record<string, number>] {
  const calls: Record<string, number> = {};
  const watched = new Proxy(target, {
    get(base, key) {
      const value = Reflect.get(base, key, base);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls[String(key)] = (calls[String(key)] ?? 0) + 1;
        return (value as (...rest: unknown[]) => unknown).apply(base, args);
      };
    },
  });
  return [watched, calls];
}

test('closing a round counts its history instead of loading it', async () => {
  // The request key needs one number — how many closings came before this one.
  // It used to get it by loading every run the round had ever had and reading a
  // length off the array, and every succeeded run in that history carries a
  // whole Stone Map in its `result` column. Closing is on this path, so the
  // cost of closing grew with how often the round had been closed before.
  const { close, aiAnalysisRunRepo } = harness('round-closure-9');
  await close();
  await finishQueuedRun(aiAnalysisRunRepo, { state: 'succeeded' });

  const [watched, calls] = counting(aiAnalysisRunRepo);
  const outcome = await enqueueAiAnalyticsOnClosure(
    'round-closure-9',
    THRESHOLD,
    watched,
    surveyRepoWith(THRESHOLD),
  );

  assert.equal(outcome, 'enqueued');
  assert.equal(calls.countByTrigger, 1);
  assert.equal(
    calls.findByRoundId,
    undefined,
    'the dispatch must not read the round\'s runs, results and all',
  );
  assert.equal(
    (await aiAnalysisRunRepo.findByRoundId('round-closure-9'))[1].requestKey,
    'closure:2',
    'and the key it computed from the count must be the one it computed before',
  );
});
