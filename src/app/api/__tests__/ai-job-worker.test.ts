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

/**
 * What a claimed partial run carries, and what an ordinary one does not.
 *
 * The previous map travels with the lease rather than being fetched afterwards
 * because the two belong together: a result read a moment later could belong
 * to a different run, and the worker has no manager-scoped way to ask for it.
 */

async function seedAnalysedRound(roundId: string, result: Record<string, unknown>) {
  const seeded = await repository.enqueue(roundId, {
    requestKey: 'seed',
    trigger: 'closure',
  });
  const lease = await repository.claimNext({
    workerId: 'seed-worker',
    leaseMs: 60_000,
  });
  assert.ok(lease);
  await repository.finish(seeded.run.id, {
    state: 'succeeded',
    leaseToken: lease.leaseToken,
    result,
  });
}

test('a claimed partial run carries its dimensions and the map it amends', async () => {
  const previous = { roundId: 'round-partial', stones: { balance: {} } };
  await seedAnalysedRound('round-partial', previous);
  await repository.enqueue('round-partial', {
    requestKey: 'manual:one',
    trigger: 'manual',
    regenerateDimensionIds: ['balance'],
  });

  const claimed = await claimJob(
    workerRequest('http://localhost/api/ai-analysis-runs/claim', { workerId: 'w1' }),
  );
  const payload = await claimed.json();

  assert.deepStrictEqual(payload.run.regenerateDimensionIds, ['balance']);
  assert.deepStrictEqual(payload.previousResult, previous);
});

test('an ordinary run names no dimensions and is sent no previous map', async () => {
  // A whole-round run rebuilds every stone and has no use for the old ones, so
  // the response stays exactly the size it was.
  const previous = { roundId: 'round-whole', stones: { balance: {} } };
  await seedAnalysedRound('round-whole', previous);
  await repository.enqueue('round-whole', {
    requestKey: 'manual:whole',
    trigger: 'manual',
  });

  const claimed = await claimJob(
    workerRequest('http://localhost/api/ai-analysis-runs/claim', { workerId: 'w1' }),
  );
  const payload = await claimed.json();

  assert.deepStrictEqual(payload.run.regenerateDimensionIds, []);
  assert.strictEqual(payload.previousResult, null);
});

/*
 * The answer that lets two workers share one paid quota.
 *
 * The worker's rate limiter is module state, so it protects one process. Core
 * is the only thing both processes can see, and it already knows who holds a
 * lease — so it says so, on the two round-trips a worker already makes. The
 * ids travel rather than a count because the `base:lane` shape belongs to the
 * worker: collapsing three lanes of one container into one sender is its job,
 * not Core's.
 */
test('a claim and a heartbeat both name the workers holding a live lease', async () => {
  await repository.enqueue('round-fleet-a', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  await repository.enqueue('round-fleet-b', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });

  const first = await claimJob(
    workerRequest('http://localhost/api/ai-analysis-runs/claim', {
      workerId: 'worker-a:1',
    }),
  );
  const firstPayload = await first.json();
  assert.deepStrictEqual(
    firstPayload.liveWorkerIds,
    ['worker-a:1'],
    'a worker that has just claimed is one of the live senders itself',
  );

  const second = await claimJob(
    workerRequest('http://localhost/api/ai-analysis-runs/claim', {
      workerId: 'worker-b:1',
    }),
  );
  const secondPayload = await second.json();
  assert.deepStrictEqual(secondPayload.liveWorkerIds, [
    'worker-a:1',
    'worker-b:1',
  ]);

  // The first worker never claims again — it is mid-round. Its renewal is the
  // only place left to tell it that a second process started sending.
  const renewed = await heartbeatJob(
    workerRequest(
      `http://localhost/api/ai-analysis-runs/${firstPayload.run.id}/heartbeat`,
      { leaseToken: firstPayload.leaseToken },
    ),
    { params: Promise.resolve({ runId: firstPayload.run.id }) },
  );
  assert.strictEqual(renewed.status, 200);
  assert.deepStrictEqual((await renewed.json()).liveWorkerIds, [
    'worker-a:1',
    'worker-b:1',
  ]);
});
