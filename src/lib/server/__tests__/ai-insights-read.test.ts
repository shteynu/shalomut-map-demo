import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryAiInsightsRepository,
} from '@/lib/repositories';
import { readAiInsights } from '../ai-insights-service';

const RESULT = { contractVersion: '5.0', status: 'success' };

async function succeededRun(roundId: string) {
  const aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  const enqueued = await aiAnalysisRunRepo.enqueue(roundId, {
    requestKey: 'manual',
    trigger: 'manual',
  });
  assert.equal(enqueued.outcome, 'enqueued');
  const lease = await aiAnalysisRunRepo.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-1',
  });
  assert.ok(lease);
  return { aiAnalysisRunRepo, lease };
}

test('the durable run owns the result a manager reads', async () => {
  const { aiAnalysisRunRepo, lease } = await succeededRun('round-read-1');
  await aiAnalysisRunRepo.finish(lease.run.id, {
    state: 'succeeded',
    leaseToken: lease.leaseToken,
    result: RESULT,
  });

  const read = await readAiInsights('round-read-1', {
    aiAnalysisRunRepo,
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
  });

  assert.equal(read.outcome, 'found');
  assert.deepEqual(read.outcome === 'found' ? read.insights : null, RESULT);
});

test('a re-analysis in flight does not take the previous map away', async () => {
  const { aiAnalysisRunRepo, lease } = await succeededRun('round-read-2');
  const aiInsightsRepo = new InMemoryAiInsightsRepository();
  await aiInsightsRepo.save('round-read-2', RESULT);

  const read = await readAiInsights('round-read-2', {
    aiAnalysisRunRepo,
    aiInsightsRepo,
  });

  /*
   * This reverses what this file used to hold, and the reversal is the point.
   * The running run used to win, on the reasoning that a queued analysis must
   * not be answered with a stale Stone Map. But that map is not stale — it is
   * the round's real, previous, successful result, and taking it away for the
   * three minutes a re-run takes, or for good when the re-run fails, cost more
   * than showing it ever did. It is returned with the run beside it, which is
   * what lets the screen say it is being replaced.
   */
  assert.equal(read.outcome, 'found');
  assert.deepEqual(read.outcome === 'found' ? read.insights : null, RESULT);
  assert.equal(read.outcome === 'found' ? read.run?.id : null, lease.run.id);
  assert.equal(read.outcome === 'found' ? read.run?.state : null, 'running');
});

test('a re-analysis that failed leaves the last successful map readable', async () => {
  // The sharper half. A failed re-run used to hide the map indefinitely, while
  // the successful result it was replacing sat in the database the whole time.
  const { aiAnalysisRunRepo, lease } = await succeededRun('round-read-5');
  await aiAnalysisRunRepo.finish(lease.run.id, {
    state: 'succeeded',
    leaseToken: lease.leaseToken,
    result: RESULT,
  });

  const requeued = await aiAnalysisRunRepo.enqueue('round-read-5', {
    requestKey: 'manual-2',
    trigger: 'manual',
  });
  assert.equal(requeued.outcome, 'enqueued');
  const second = await aiAnalysisRunRepo.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-1',
  });
  assert.ok(second);
  await aiAnalysisRunRepo.finish(second.run.id, {
    state: 'failed',
    leaseToken: second.leaseToken,
    failureCode: 'provider_unavailable',
  });

  const read = await readAiInsights('round-read-5', {
    aiAnalysisRunRepo,
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
  });

  assert.equal(read.outcome, 'found');
  assert.deepEqual(read.outcome === 'found' ? read.insights : null, RESULT);
  // And the failure travels with it, so the screen can say why the map did not
  // change rather than presenting it as current.
  assert.equal(read.outcome === 'found' ? read.run?.state : null, 'failed');
  assert.equal(
    read.outcome === 'found' ? read.run?.failureCode : null,
    'provider_unavailable',
  );
});

test('without a run the legacy column is still read', async () => {
  const aiInsightsRepo = new InMemoryAiInsightsRepository();
  await aiInsightsRepo.save('round-read-3', RESULT);

  const read = await readAiInsights('round-read-3', {
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo,
  });

  assert.equal(read.outcome, 'found');
  assert.deepEqual(read.outcome === 'found' ? read.insights : null, RESULT);
});

test('nothing stored anywhere reports a missing result and no run', async () => {
  const read = await readAiInsights('round-read-4', {
    aiAnalysisRunRepo: new InMemoryAiAnalysisRunRepository(),
    aiInsightsRepo: new InMemoryAiInsightsRepository(),
  });

  assert.equal(read.outcome, 'missing');
  assert.equal(read.outcome === 'missing' ? read.run : undefined, null);
});
