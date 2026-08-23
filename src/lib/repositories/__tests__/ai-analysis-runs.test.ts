import assert from 'node:assert';
import test from 'node:test';
import { InMemoryAiAnalysisRunRepository } from '../in-memory/in-memory-ai-analysis-run.repository';

test('enqueue is idempotent by request key and permits only one active run per round', async () => {
  let now = new Date('2026-07-30T10:00:00.000Z');
  const repository = new InMemoryAiAnalysisRunRepository({ now: () => now });

  const first = await repository.enqueue('round-1', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  assert.strictEqual(first.outcome, 'enqueued');
  assert.strictEqual(first.run.state, 'queued');
  assert.strictEqual(first.run.attemptCount, 0);

  const duplicate = await repository.enqueue('round-1', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  assert.strictEqual(duplicate.outcome, 'duplicate');
  assert.strictEqual(duplicate.run.id, first.run.id);

  const overlappingManualRun = await repository.enqueue('round-1', {
    requestKey: 'manager-1',
    trigger: 'manual',
  });
  assert.strictEqual(overlappingManualRun.outcome, 'already_active');
  assert.strictEqual(overlappingManualRun.run.id, first.run.id);

  const lease = await repository.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-1',
  });
  assert.ok(lease);
  assert.strictEqual(
    await repository.finish(lease.run.id, {
      state: 'succeeded',
      leaseToken: lease.leaseToken,
      result: { status: 'success' },
    }),
    'transitioned',
  );
  assert.deepStrictEqual(
    (await repository.findById(lease.run.id))?.result,
    { status: 'success' },
  );

  now = new Date('2026-07-30T10:01:00.000Z');
  const rerun = await repository.enqueue('round-1', {
    requestKey: 'manager-1',
    trigger: 'manual',
  });
  assert.strictEqual(rerun.outcome, 'enqueued');
  assert.notStrictEqual(rerun.run.id, first.run.id);
});

test('claim, heartbeat and lease expiry recover abandoned work without concurrent ownership', async () => {
  let timestamp = Date.parse('2026-07-30T11:00:00.000Z');
  const repository = new InMemoryAiAnalysisRunRepository({
    now: () => new Date(timestamp),
  });
  await repository.enqueue('round-lease', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });

  const firstLease = await repository.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-1',
  });
  assert.ok(firstLease);
  assert.strictEqual(firstLease.run.state, 'running');
  assert.strictEqual(firstLease.run.attemptCount, 1);
  assert.strictEqual(
    await repository.claimNext({ leaseMs: 60_000, workerId: 'worker-2' }),
    null,
  );

  timestamp += 30_000;
  assert.strictEqual(
    await repository.heartbeat(firstLease.run.id, firstLease.leaseToken, {
      leaseMs: 60_000,
    }),
    true,
  );

  timestamp += 31_000;
  assert.strictEqual(
    await repository.claimNext({ leaseMs: 60_000, workerId: 'worker-2' }),
    null,
    'the heartbeat extended the original lease',
  );

  timestamp += 30_000;
  const recovered = await repository.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-2',
  });
  assert.ok(recovered);
  assert.strictEqual(recovered.run.id, firstLease.run.id);
  assert.strictEqual(recovered.run.attemptCount, 2);
  assert.notStrictEqual(recovered.leaseToken, firstLease.leaseToken);
  assert.strictEqual(
    await repository.heartbeat(firstLease.run.id, firstLease.leaseToken, {
      leaseMs: 60_000,
    }),
    false,
    'the expired owner cannot renew a replacement lease',
  );

  timestamp += 61_000;
  assert.strictEqual(
    await repository.claimNext({
      leaseMs: 60_000,
      maxAttempts: 2,
      workerId: 'worker-3',
    }),
    null,
  );
  const exhausted = await repository.findById(firstLease.run.id);
  assert.strictEqual(exhausted?.state, 'failed');
  assert.strictEqual(exhausted?.failureCode, 'lease_exhausted');
});

test('completion is idempotent and a late callback cannot revive a failed run', async () => {
  const repository = new InMemoryAiAnalysisRunRepository();
  const queued = await repository.enqueue('round-callback', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  const lease = await repository.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-1',
  });
  assert.ok(lease);

  assert.strictEqual(
    await repository.finish(queued.run.id, {
      state: 'failed',
      failureCode: 'provider_error',
      leaseToken: lease.leaseToken,
    }),
    'transitioned',
  );
  assert.strictEqual(
    await repository.finish(queued.run.id, {
      state: 'failed',
      failureCode: 'provider_error',
      leaseToken: lease.leaseToken,
    }),
    'duplicate',
  );
  assert.strictEqual(
    await repository.finish(queued.run.id, {
      state: 'succeeded',
      leaseToken: lease.leaseToken,
      result: { status: 'success' },
    }),
    'stale',
  );

  const retry = await repository.enqueue('round-callback', {
    requestKey: 'manager-retry',
    trigger: 'manual',
  });
  assert.strictEqual(retry.outcome, 'enqueued');
  const retryLease = await repository.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-2',
  });
  assert.ok(retryLease);
  assert.strictEqual(
    await repository.finish(queued.run.id, {
      state: 'succeeded',
      leaseToken: lease.leaseToken,
      result: { status: 'success' },
    }),
    'stale',
    'a late callback for the failed run cannot affect its replacement',
  );
  assert.strictEqual(
    await repository.finish(retry.run.id, {
      state: 'succeeded',
      leaseToken: lease.leaseToken,
      result: { status: 'success' },
    }),
    'stale',
    'the previous owner cannot finish the replacement run',
  );
  assert.strictEqual(
    await repository.finish(retry.run.id, {
      state: 'succeeded',
      leaseToken: retryLease.leaseToken,
      result: { status: 'success' },
    }),
    'transitioned',
  );
  assert.strictEqual((await repository.findLatestByRoundId('round-callback'))?.id, retry.run.id);
});

test('completion requires a live lease and an idempotent retry must carry the same result', async () => {
  let timestamp = Date.parse('2026-07-30T12:00:00.000Z');
  const repository = new InMemoryAiAnalysisRunRepository({
    now: () => new Date(timestamp),
  });
  await repository.enqueue('round-expiry', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  const expiredLease = await repository.claimNext({
    leaseMs: 1_000,
    workerId: 'worker-expired',
  });
  assert.ok(expiredLease);

  timestamp += 1_001;
  assert.strictEqual(
    await repository.finish(expiredLease.run.id, {
      state: 'succeeded',
      leaseToken: expiredLease.leaseToken,
      result: { status: 'success', revision: 1 },
    }),
    'stale',
    'an expired owner must not complete work before another worker reclaims it',
  );

  const recovered = await repository.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-recovered',
  });
  assert.ok(recovered);
  const result = { status: 'success', nested: { revision: 2, ready: true } };
  assert.strictEqual(
    await repository.finish(recovered.run.id, {
      state: 'succeeded',
      leaseToken: recovered.leaseToken,
      result,
    }),
    'transitioned',
  );
  assert.strictEqual(
    await repository.finish(recovered.run.id, {
      state: 'succeeded',
      leaseToken: recovered.leaseToken,
      result: { nested: { ready: true, revision: 2 }, status: 'success' },
    }),
    'duplicate',
    'object key order must not affect callback idempotency',
  );
  assert.strictEqual(
    await repository.finish(recovered.run.id, {
      state: 'succeeded',
      leaseToken: recovered.leaseToken,
      result: { status: 'success', nested: { revision: 3, ready: true } },
    }),
    'stale',
    'a second payload under the old token must not be accepted as a retry',
  );
});

test('reset invalidates every queued, running or completed run for the round', async () => {
  const repository = new InMemoryAiAnalysisRunRepository();
  await repository.enqueue('round-reset', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  await repository.claimNext({ leaseMs: 60_000, workerId: 'worker-1' });

  await repository.deleteByRoundId('round-reset');

  assert.strictEqual(await repository.findLatestByRoundId('round-reset'), null);
  const fresh = await repository.enqueue('round-reset', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  assert.strictEqual(fresh.outcome, 'enqueued');
});

/*
 * Who is spending the provider's quota right now.
 *
 * The worker's pace is module state in one process, so two processes used to
 * keep two private counters against a quota counted once per key. This read is
 * how a worker learns it is not alone; what it must never do is name a worker
 * that has stopped, because a phantom peer makes every remaining worker send
 * slower than the account has paid for.
 */
test('the live lease holders are named, and an expired lease names nobody', async () => {
  let timestamp = Date.parse('2026-08-23T09:00:00.000Z');
  const repository = new InMemoryAiAnalysisRunRepository({
    now: () => new Date(timestamp),
  });
  await repository.enqueue('round-live-a', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  await repository.enqueue('round-live-b', {
    requestKey: 'automatic',
    trigger: 'automatic',
  });

  assert.deepStrictEqual(
    await repository.readLiveWorkerIds(32),
    [],
    'a queued run is nobody sending',
  );

  const first = await repository.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-a:1',
  });
  const second = await repository.claimNext({
    leaseMs: 60_000,
    workerId: 'worker-b:1',
  });
  assert.ok(first && second);
  assert.deepStrictEqual(await repository.readLiveWorkerIds(32), [
    'worker-a:1',
    'worker-b:1',
  ]);

  // The second worker keeps its lease alive; the first one stops.
  timestamp += 30_000;
  assert.strictEqual(
    await repository.heartbeat(second.run.id, second.leaseToken, {
      leaseMs: 60_000,
    }),
    true,
  );
  timestamp += 31_000;
  assert.deepStrictEqual(
    await repository.readLiveWorkerIds(32),
    ['worker-b:1'],
    'a lease that ran out is not a worker that is still sending',
  );

  assert.deepStrictEqual(
    await repository.readLiveWorkerIds(1),
    ['worker-b:1'],
    'the cap bounds the answer rather than changing which rows qualify',
  );
  assert.deepStrictEqual(await repository.readLiveWorkerIds(0), []);
});
