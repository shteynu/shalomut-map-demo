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

test('a run without a result explains its own absence', async () => {
  const { aiAnalysisRunRepo, lease } = await succeededRun('round-read-2');
  // The legacy column holds a result for the same round; the run still wins,
  // so a queued analysis cannot be answered with a stale Stone Map.
  const aiInsightsRepo = new InMemoryAiInsightsRepository();
  await aiInsightsRepo.save('round-read-2', RESULT);

  const read = await readAiInsights('round-read-2', {
    aiAnalysisRunRepo,
    aiInsightsRepo,
  });

  assert.equal(read.outcome, 'missing');
  assert.equal(read.outcome === 'missing' ? read.run?.id : null, lease.run.id);
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
