/**
 * The two endpoints that answer "is anybody taking the work?".
 *
 * Driven through the in-memory repository on a fake clock, so the ten-minute
 * threshold is exercised without waiting ten minutes and without a database.
 * What is proved here that the unit test cannot: the snapshot the repository
 * builds and the verdict the route publishes agree, and the public path says
 * nothing but the verdict.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';

import { GET as publicQueueHealth } from '../health/ai-queue/route';
import { GET as operatorQueueHealth } from '../ai-analysis-runs/queue/route';
import { POST as claimJob } from '../ai-analysis-runs/claim/route';
import { InMemoryAiAnalysisRunRepository } from '@/lib/repositories';
import {
  overrideCoreRepositories,
  resetCoreRepositories,
} from '@/lib/composition-root';
import { AI_ANALYSIS_QUEUE_STALL_AFTER_MS } from '@/lib/server/ai-analysis-worker';

const workerSecret = 'queue-health-test-secret';

let previousDatabaseUrl: string | undefined;
let previousCallbackSecret: string | undefined;
let repository: InMemoryAiAnalysisRunRepository;
let now = new Date('2026-08-23T10:00:00.000Z');

function advance(milliseconds: number) {
  now = new Date(now.getTime() + milliseconds);
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  previousCallbackSecret = process.env.AI_CALLBACK_SECRET;
  delete process.env.DATABASE_URL;
  process.env.AI_CALLBACK_SECRET = workerSecret;
});

beforeEach(() => {
  now = new Date('2026-08-23T10:00:00.000Z');
  repository = new InMemoryAiAnalysisRunRepository({ now: () => now });
  overrideCoreRepositories({ aiAnalysisRunRepo: repository });
});

after(() => {
  resetCoreRepositories();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousCallbackSecret === undefined) {
    delete process.env.AI_CALLBACK_SECRET;
  } else {
    process.env.AI_CALLBACK_SECRET = previousCallbackSecret;
  }
});

function operatorRequest(authenticated = true) {
  return new Request('http://localhost/api/ai-analysis-runs/queue', {
    headers: authenticated
      ? { Authorization: `Bearer ${workerSecret}` }
      : undefined,
  });
}

function claimRequest() {
  return new Request('http://localhost/api/ai-analysis-runs/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${workerSecret}`,
    },
    body: JSON.stringify({ workerId: 'worker-1' }),
  });
}

async function readPublic() {
  const response = await publicQueueHealth();
  return { response, body: await response.json() };
}

async function readOperator(authenticated = true) {
  const response = await operatorQueueHealth(operatorRequest(authenticated));
  return { response, body: await response.json() };
}

test('an empty queue answers 200 idle and publishes no numbers anonymously', async () => {
  const { response, body } = await readPublic();

  assert.strictEqual(response.status, 200);
  assert.strictEqual(body.status, 'idle');
  assert.deepStrictEqual(
    Object.keys(body).sort(),
    ['commit', 'status'],
    'the public verdict must carry no depth, no wait and no round',
  );
});

test('a round waiting past the threshold with nobody working turns the public path 503', async () => {
  await repository.enqueue('round-stalled', {
    requestKey: 'closure',
    trigger: 'closure',
  });

  const early = await readPublic();
  assert.strictEqual(early.response.status, 200);
  assert.strictEqual(early.body.status, 'draining');

  advance(AI_ANALYSIS_QUEUE_STALL_AFTER_MS + 1_000);

  const late = await readPublic();
  assert.strictEqual(late.response.status, 503);
  assert.strictEqual(late.body.status, 'stalled');
});

test('a busy worker keeps a long backlog out of the alert', async () => {
  await repository.enqueue('round-1', {
    requestKey: 'closure',
    trigger: 'closure',
  });
  await repository.enqueue('round-2', {
    requestKey: 'closure',
    trigger: 'closure',
  });

  const claimed = await claimJob(claimRequest());
  assert.strictEqual(claimed.status, 200);
  const lease = await claimed.json();

  // Far past the threshold, but the claimed run's lease keeps being renewed, so
  // a consumer is demonstrably alive and round-2 is waiting for it.
  for (
    let elapsed = 0;
    elapsed < AI_ANALYSIS_QUEUE_STALL_AFTER_MS * 2;
    elapsed += 30_000
  ) {
    advance(30_000);
    const renewed = await repository.heartbeat(lease.run.id, lease.leaseToken, {
      leaseMs: 90_000,
    });
    assert.ok(renewed, 'the heartbeat must keep the lease alive');
  }

  const { response, body } = await readPublic();
  assert.strictEqual(response.status, 200);
  assert.strictEqual(body.status, 'draining');

  const operator = await readOperator();
  assert.strictEqual(operator.body.leasedCount, 1);
  assert.strictEqual(operator.body.waitingCount, 1);
  assert.ok(
    operator.body.oldestWaitSeconds > AI_ANALYSIS_QUEUE_STALL_AFTER_MS / 1000,
    'the wait itself is long — it is the lease that makes it healthy',
  );
});

test('a worker that dies mid-run is reported once its lease expires', async () => {
  await repository.enqueue('round-abandoned', {
    requestKey: 'closure',
    trigger: 'closure',
  });
  const claimed = await claimJob(claimRequest());
  assert.strictEqual(claimed.status, 200);

  // Still leased: the worker has 90 seconds of credit even if it is already gone.
  advance(60_000);
  const leased = await readOperator();
  assert.strictEqual(leased.body.status, 'idle');
  assert.strictEqual(leased.body.leasedCount, 1);
  assert.strictEqual(leased.body.waitingCount, 0);

  // The lease expires. The run is takeable again and nobody is taking it.
  advance(31_000);
  const abandoned = await readOperator();
  assert.strictEqual(abandoned.body.status, 'draining');
  assert.strictEqual(abandoned.body.waitingCount, 1);
  assert.strictEqual(abandoned.body.leasedCount, 0);

  // Measured from the expiry, not from when the run was queued.
  assert.strictEqual(abandoned.body.oldestWaitSeconds, 1);

  advance(AI_ANALYSIS_QUEUE_STALL_AFTER_MS);
  const stalled = await readOperator();
  assert.strictEqual(stalled.body.status, 'stalled');
});

test('the numbers refuse an unauthenticated caller', async () => {
  const { response, body } = await readOperator(false);

  assert.strictEqual(response.status, 401);
  assert.strictEqual(body.error, 'Unauthorized worker');
  assert.strictEqual(body.waitingCount, undefined);
});

test('the operator path publishes the threshold it judged against', async () => {
  const { body } = await readOperator();

  assert.strictEqual(
    body.stallAfterSeconds,
    Math.floor(AI_ANALYSIS_QUEUE_STALL_AFTER_MS / 1000),
  );
  assert.strictEqual(body.observedAt, now.toISOString());
});
