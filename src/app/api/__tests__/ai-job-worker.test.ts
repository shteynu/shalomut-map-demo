import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { POST as claimJob } from '../ai-analysis-runs/claim/route';
import { POST as heartbeatJob } from '../ai-analysis-runs/[runId]/heartbeat/route';
import { POST as failJob } from '../ai-analysis-runs/[runId]/fail/route';
import { InMemoryAiAnalysisRunRepository } from '@/lib/repositories';
import { overrideCoreRepositories, resetCoreRepositories } from '@/lib/composition-root';

const workerSecret = 'worker-test-secret';
let previousDatabaseUrl: string | undefined;
let previousCallbackSecret: string | undefined;
let repository: InMemoryAiAnalysisRunRepository;

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  previousCallbackSecret = process.env.AI_CALLBACK_SECRET;
  delete process.env.DATABASE_URL;
  process.env.AI_CALLBACK_SECRET = workerSecret;
});

beforeEach(() => {
  repository = new InMemoryAiAnalysisRunRepository();
  overrideCoreRepositories({ aiAnalysisRunRepo: repository });
});

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousCallbackSecret === undefined) delete process.env.AI_CALLBACK_SECRET;
  else process.env.AI_CALLBACK_SECRET = previousCallbackSecret;
});

function workerRequest(url: string, body: Record<string, unknown>, authenticated = true) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? { Authorization: `Bearer ${workerSecret}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('worker claim requires authentication and atomically leases one queued job', async () => {
  const enqueued = await repository.enqueue('round-worker', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });

  const unauthorized = await claimJob(
    workerRequest('http://localhost/api/ai-analysis-runs/claim', { workerId: 'w1' }, false),
  );
  assert.strictEqual(unauthorized.status, 401);

  const claimed = await claimJob(
    workerRequest('http://localhost/api/ai-analysis-runs/claim', { workerId: 'w1' }),
  );
  assert.strictEqual(claimed.status, 200);
  const payload = await claimed.json();
  assert.strictEqual(payload.run.id, enqueued.run.id);
  assert.strictEqual(payload.run.roundId, 'round-worker');
  assert.strictEqual(payload.run.state, 'running');
  assert.strictEqual(payload.run.attemptCount, 1);
  assert.strictEqual(typeof payload.leaseToken, 'string');

  const noSecondOwner = await claimJob(
    workerRequest('http://localhost/api/ai-analysis-runs/claim', { workerId: 'w2' }),
  );
  assert.strictEqual(noSecondOwner.status, 204);
});

test('heartbeat and fail require the current lease token', async () => {
  await repository.enqueue('round-heartbeat', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  const claimResponse = await claimJob(
    workerRequest('http://localhost/api/ai-analysis-runs/claim', { workerId: 'w1' }),
  );
  const claim = await claimResponse.json();

  const staleHeartbeat = await heartbeatJob(
    workerRequest(
      `http://localhost/api/ai-analysis-runs/${claim.run.id}/heartbeat`,
      { leaseToken: '00000000-0000-4000-8000-000000000000' },
    ),
    { params: Promise.resolve({ runId: claim.run.id }) },
  );
  assert.strictEqual(staleHeartbeat.status, 409);

  const heartbeat = await heartbeatJob(
    workerRequest(
      `http://localhost/api/ai-analysis-runs/${claim.run.id}/heartbeat`,
      { leaseToken: claim.leaseToken },
    ),
    { params: Promise.resolve({ runId: claim.run.id }) },
  );
  assert.strictEqual(heartbeat.status, 200);

  const staleFailure = await failJob(
    workerRequest(
      `http://localhost/api/ai-analysis-runs/${claim.run.id}/fail`,
      {
        leaseToken: '00000000-0000-4000-8000-000000000000',
        failureCode: 'worker_error',
      },
    ),
    { params: Promise.resolve({ runId: claim.run.id }) },
  );
  assert.strictEqual(staleFailure.status, 409);

  const failed = await failJob(
    workerRequest(
      `http://localhost/api/ai-analysis-runs/${claim.run.id}/fail`,
      { leaseToken: claim.leaseToken, failureCode: 'worker_error' },
    ),
    { params: Promise.resolve({ runId: claim.run.id }) },
  );
  assert.strictEqual(failed.status, 200);
  assert.strictEqual(
    (await repository.findById(claim.run.id))?.state,
    'failed',
  );
});
