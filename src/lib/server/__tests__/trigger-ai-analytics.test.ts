import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
} from '@/lib/repositories';
import type { ISurveyRepository } from '@/lib/repositories/interfaces';
import type { OperationalMetric } from '../ai-operational-metrics';
import { setOperationalMetricSinkForTests } from '../ai-operational-metrics';
import {
  AI_ANALYSIS_AUTOMATIC_MAX_RUNS,
  enqueueAiAnalyticsAfterResponse,
} from '../trigger-ai-analytics';

const THRESHOLD = 10;

/**
 * The automatic path asks the survey repository exactly one question, so the
 * stub answers exactly that one. A fuller fake would only hide which fact the
 * decision actually rests on.
 */
function surveyRepoWith(responseCount: number): ISurveyRepository {
  return {
    getResponseCount: async () => responseCount,
  } as unknown as ISurveyRepository;
}

interface Harness {
  aiAnalysisRunRepo: InMemoryAiAnalysisRunRepository;
  aiInsightsRepo: InMemoryAiInsightsRepository;
  enqueue: (responseCount?: number) => Promise<string>;
}

function harness(roundId: string): Harness {
  const aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  const aiInsightsRepo = new InMemoryAiInsightsRepository();
  return {
    aiAnalysisRunRepo,
    aiInsightsRepo,
    enqueue: (responseCount = THRESHOLD) =>
      enqueueAiAnalyticsAfterResponse(
        roundId,
        THRESHOLD,
        aiAnalysisRunRepo,
        aiInsightsRepo,
        surveyRepoWith(responseCount),
      ),
  };
}

/** Claims whatever is queued and ends it, the way a callback would. */
async function finishQueuedRun(
  repo: InMemoryAiAnalysisRunRepository,
  outcome:
    | { state: 'succeeded' }
    | { state: 'failed'; failureCode: string },
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

test('below the privacy threshold nothing is enqueued', async () => {
  const { enqueue, aiAnalysisRunRepo } = harness('round-rearm-1');

  assert.equal(await enqueue(THRESHOLD - 1), 'below_threshold');
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId('round-rearm-1'), []);
});

test('crossing the threshold enqueues the round-s first automatic run', async () => {
  const { enqueue, aiAnalysisRunRepo } = harness('round-rearm-2');

  assert.equal(await enqueue(), 'enqueued');

  const runs = await aiAnalysisRunRepo.findByRoundId('round-rearm-2');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].requestKey, 'automatic');
  assert.equal(runs[0].trigger, 'automatic');
});

test('a run already in flight is not joined by a second one', async () => {
  const { enqueue, aiAnalysisRunRepo } = harness('round-rearm-3');
  assert.equal(await enqueue(), 'enqueued');

  assert.equal(await enqueue(THRESHOLD + 1), 'already_active');
  assert.equal(
    (await aiAnalysisRunRepo.findByRoundId('round-rearm-3')).length,
    1,
  );
});

test('a response that lands mid-analysis re-arms the automatic path', async () => {
  // The defect this slice exists for: the run analysed ten responses, the
  // eleventh arrived before the callback, and Core refused the result because
  // its own recalculated aggregates no longer matched.
  const { enqueue, aiAnalysisRunRepo } = harness('round-rearm-4');
  assert.equal(await enqueue(), 'enqueued');
  await finishQueuedRun(aiAnalysisRunRepo, {
    state: 'failed',
    failureCode: 'round_validation_failed',
  });

  assert.equal(await enqueue(THRESHOLD + 1), 'enqueued');

  const runs = await aiAnalysisRunRepo.findByRoundId('round-rearm-4');
  assert.equal(runs.length, 2);
  // The failed run stays as evidence rather than being reset in place.
  assert.equal(runs[0].state, 'failed');
  assert.equal(runs[0].failureCode, 'round_validation_failed');
  assert.equal(runs[1].state, 'queued');
  assert.equal(runs[1].requestKey, 'automatic:2');
});

test('the re-arm is counted so its rate can be read later', async () => {
  const metrics: OperationalMetric[] = [];
  setOperationalMetricSinkForTests((metric) => metrics.push(metric));
  try {
    const { enqueue, aiAnalysisRunRepo } = harness('round-rearm-5');
    await enqueue();
    await finishQueuedRun(aiAnalysisRunRepo, {
      state: 'failed',
      failureCode: 'round_validation_failed',
    });
    metrics.length = 0;

    await enqueue(THRESHOLD + 1);

    const rearmed = metrics.filter(
      (metric) => metric.name === 'ai_jobs_rearmed',
    );
    assert.equal(rearmed.length, 1);
    assert.equal(rearmed[0].labels?.attempt, '2');
    assert.equal(
      rearmed[0].labels?.previousFailureCode,
      'round_validation_failed',
    );
    assert.equal(rearmed[0].roundId, 'round-rearm-5');
  } finally {
    setOperationalMetricSinkForTests(null);
  }
});

test('the first automatic run is not counted as a re-arm', async () => {
  const metrics: OperationalMetric[] = [];
  setOperationalMetricSinkForTests((metric) => metrics.push(metric));
  try {
    await harness('round-rearm-6').enqueue();
    assert.equal(
      metrics.some((metric) => metric.name === 'ai_jobs_rearmed'),
      false,
    );
  } finally {
    setOperationalMetricSinkForTests(null);
  }
});

test('a failure a fresh input cannot fix is not retried', async () => {
  for (const failureCode of [
    'contract_validation_failed',
    'analysis_validation_failed',
    'lease_exhausted',
    // The analytics service now says why the provider was unavailable, so the
    // code Core stores varies per run. Only `round_validation_failed` re-arms,
    // and that is Core's own code — a more specific provider code must not
    // become retryable by being unrecognised.
    'provider_unavailable_missing_api_key',
  ]) {
    const roundId = `round-rearm-7-${failureCode}`;
    const { enqueue, aiAnalysisRunRepo } = harness(roundId);
    await enqueue();
    await finishQueuedRun(aiAnalysisRunRepo, { state: 'failed', failureCode });

    assert.equal(
      await enqueue(THRESHOLD + 1),
      'not_retryable',
      `${failureCode} must not re-arm`,
    );
    assert.equal((await aiAnalysisRunRepo.findByRoundId(roundId)).length, 1);
  }
});

test('re-arming stops at the cap instead of following every response', async () => {
  const { enqueue, aiAnalysisRunRepo } = harness('round-rearm-8');

  for (let attempt = 1; attempt <= AI_ANALYSIS_AUTOMATIC_MAX_RUNS; attempt += 1) {
    assert.equal(await enqueue(THRESHOLD + attempt), 'enqueued');
    await finishQueuedRun(aiAnalysisRunRepo, {
      state: 'failed',
      failureCode: 'round_validation_failed',
    });
  }

  assert.equal(await enqueue(THRESHOLD + 99), 'retries_exhausted');
  assert.equal(
    (await aiAnalysisRunRepo.findByRoundId('round-rearm-8')).length,
    AI_ANALYSIS_AUTOMATIC_MAX_RUNS,
  );
});

test('a manual run that succeeded closes the automatic path', async () => {
  const { enqueue, aiAnalysisRunRepo } = harness('round-rearm-9');
  await enqueue();
  await finishQueuedRun(aiAnalysisRunRepo, {
    state: 'failed',
    failureCode: 'round_validation_failed',
  });
  await aiAnalysisRunRepo.enqueue('round-rearm-9', {
    requestKey: 'manual:once',
    trigger: 'manual',
  });
  await finishQueuedRun(aiAnalysisRunRepo, { state: 'succeeded' });

  assert.equal(await enqueue(THRESHOLD + 1), 'already_generated');
  assert.equal(
    (await aiAnalysisRunRepo.findByRoundId('round-rearm-9')).length,
    2,
  );
});

test('a persisted legacy result is never regenerated', async () => {
  const { enqueue, aiInsightsRepo, aiAnalysisRunRepo } =
    harness('round-rearm-10');
  await aiInsightsRepo.save('round-rearm-10', {
    contractVersion: '5.0',
    status: 'success',
  });

  assert.equal(await enqueue(), 'already_generated');
  assert.deepEqual(await aiAnalysisRunRepo.findByRoundId('round-rearm-10'), []);
});
