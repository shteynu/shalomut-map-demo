import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaAiAnalysisRunRepository } from '../prisma/prisma-ai-analysis-run.repository';

// This suite is intentionally outside __tests__: verify:db applies migrations
// before loading it, while the general unit suite stays database-free.
const connectionString = process.env.TEST_DATABASE_URL;
let pool: Pool | undefined;
let prisma: PrismaClient | undefined;

before(() => {
  if (!connectionString) return;
  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
});

after(async () => {
  await prisma?.$disconnect();
  await pool?.end();
});

test(
  'PostgreSQL enforces one active run and one lease owner across repository instances',
  { skip: !connectionString },
  async () => {
    assert.ok(prisma);
    const suffix = globalThis.crypto.randomUUID();
    const organizationId = `org-ai-job-${suffix}`;
    const roundId = `round-ai-job-${suffix}`;
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: 'AI job integration test',
        city: 'local',
        schoolType: 'test',
        totalStaffCount: 10,
      },
    });
    await prisma.surveyRound.create({
      data: {
        id: roundId,
        organizationId,
        title: 'Durable lifecycle concurrency',
        status: 'active',
        shareCode: `AI-JOB-${suffix}`,
        privacyThreshold: 10,
      },
    });

    try {
      const first = new PrismaAiAnalysisRunRepository(prisma as any);
      const second = new PrismaAiAnalysisRunRepository(prisma as any);
      const enqueues = await Promise.all([
        first.enqueue(roundId, { requestKey: 'manual:a', trigger: 'manual' }),
        second.enqueue(roundId, { requestKey: 'manual:b', trigger: 'manual' }),
      ]);
      assert.deepStrictEqual(
        enqueues.map((result) => result.outcome).sort(),
        ['already_active', 'enqueued'],
      );

      const claims = await Promise.all([
        first.claimNext({ workerId: 'worker-a', leaseMs: 60_000 }),
        second.claimNext({ workerId: 'worker-b', leaseMs: 60_000 }),
      ]);
      const leases = claims.filter((claim) => claim !== null);
      assert.strictEqual(leases.length, 1);
      const lease = leases[0]!;

      assert.strictEqual(
        await second.heartbeat(lease.run.id, lease.leaseToken, {
          leaseMs: 60_000,
        }),
        true,
      );
      assert.strictEqual(
        await first.finish(lease.run.id, {
          state: 'succeeded',
          leaseToken: lease.leaseToken,
          result: { status: 'success', roundId },
        }),
        'transitioned',
      );
      assert.strictEqual(
        await second.finish(lease.run.id, {
          state: 'succeeded',
          leaseToken: lease.leaseToken,
          result: { status: 'success', roundId },
        }),
        'duplicate',
      );
      assert.strictEqual(
        await second.finish(lease.run.id, {
          state: 'succeeded',
          leaseToken: lease.leaseToken,
          result: { status: 'success', roundId, revision: 2 },
        }),
        'stale',
      );
      assert.strictEqual(
        await second.finish(lease.run.id, {
          state: 'succeeded',
          leaseToken: '00000000-0000-4000-8000-000000000000',
          result: { status: 'stale', roundId },
        }),
        'stale',
      );
    } finally {
      await prisma.organization.delete({ where: { id: organizationId } });
    }
  },
);

test(
  'a numbered automatic key re-arms the round without escaping the one-active-run index',
  { skip: !connectionString },
  async () => {
    assert.ok(prisma);
    const suffix = globalThis.crypto.randomUUID();
    const organizationId = `org-ai-rearm-${suffix}`;
    const roundId = `round-ai-rearm-${suffix}`;
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: 'AI re-arm integration test',
        city: 'local',
        schoolType: 'test',
        totalStaffCount: 10,
      },
    });
    await prisma.surveyRound.create({
      data: {
        id: roundId,
        organizationId,
        title: 'Automatic re-arm',
        status: 'active',
        shareCode: `AI-REARM-${suffix}`,
        privacyThreshold: 10,
      },
    });

    try {
      const repo = new PrismaAiAnalysisRunRepository(prisma as any);
      const first = await repo.enqueue(roundId, {
        requestKey: 'automatic',
        trigger: 'automatic',
      });
      assert.strictEqual(first.outcome, 'enqueued');

      // A second attempt while the first is still queued must be refused by
      // the partial unique index, not admitted just because the key differs.
      assert.strictEqual(
        (
          await repo.enqueue(roundId, {
            requestKey: 'automatic:2',
            trigger: 'automatic',
          })
        ).outcome,
        'already_active',
      );

      const lease = await repo.claimNext({
        workerId: 'worker-rearm',
        leaseMs: 60_000,
      });
      assert.ok(lease);
      assert.strictEqual(
        await repo.finish(lease.run.id, {
          state: 'failed',
          leaseToken: lease.leaseToken,
          failureCode: 'round_validation_failed',
        }),
        'transitioned',
      );

      // Now that the round holds no active run, the numbered key is what lets
      // the automatic path start again: the original key would still collide.
      assert.strictEqual(
        (
          await repo.enqueue(roundId, {
            requestKey: 'automatic',
            trigger: 'automatic',
          })
        ).outcome,
        'duplicate',
      );
      assert.strictEqual(
        (
          await repo.enqueue(roundId, {
            requestKey: 'automatic:2',
            trigger: 'automatic',
          })
        ).outcome,
        'enqueued',
      );

      const runs = await repo.findByRoundId(roundId);
      assert.deepStrictEqual(
        runs.map((run) => [run.requestKey, run.state]),
        [
          ['automatic', 'failed'],
          ['automatic:2', 'queued'],
        ],
      );
    } finally {
      await prisma.organization.delete({ where: { id: organizationId } });
    }
  },
);

test(
  'PostgreSQL stores the dimensions a run must rewrite, and finds the map it amends',
  { skip: !connectionString },
  async () => {
    // Two things the in-memory repository cannot prove: that the column round
    // trips through Postgres as a text array rather than a JSON string, and
    // that the previous result is found by the run that succeeded rather than
    // by the one being claimed — which is the newest row at exactly that
    // moment and carries nothing.
    assert.ok(prisma);
    const suffix = globalThis.crypto.randomUUID();
    const organizationId = `org-ai-partial-${suffix}`;
    const roundId = `round-ai-partial-${suffix}`;
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: 'Partial run integration test',
        city: 'local',
        schoolType: 'test',
        totalStaffCount: 10,
      },
    });
    await prisma.surveyRound.create({
      data: {
        id: roundId,
        organizationId,
        title: 'One dimension again',
        status: 'closed',
        shareCode: `AI-PARTIAL-${suffix}`,
        privacyThreshold: 10,
      },
    });

    try {
      const repo = new PrismaAiAnalysisRunRepository(prisma as any);

      const whole = await repo.enqueue(roundId, {
        requestKey: 'closure',
        trigger: 'closure',
      });
      assert.deepStrictEqual(whole.run.regenerateDimensionIds, []);
      assert.strictEqual(await repo.findLatestResultByRoundId(roundId), null);

      const firstLease = await repo.claimNext({
        workerId: 'worker-1',
        leaseMs: 60_000,
      });
      assert.ok(firstLease);
      const stored = { roundId, stones: { balance: { score: 41 } } };
      await repo.finish(whole.run.id, {
        state: 'succeeded',
        leaseToken: firstLease.leaseToken,
        result: stored,
      });
      assert.deepStrictEqual(
        await repo.findLatestResultByRoundId(roundId),
        stored,
      );

      const partial = await repo.enqueue(roundId, {
        requestKey: `manual:${suffix}`,
        trigger: 'manual',
        regenerateDimensionIds: ['balance', 'meaning'],
      });
      assert.deepStrictEqual(partial.run.regenerateDimensionIds, [
        'balance',
        'meaning',
      ]);
      assert.deepStrictEqual(
        (await repo.findById(partial.run.id))?.regenerateDimensionIds,
        ['balance', 'meaning'],
      );

      const secondLease = await repo.claimNext({
        workerId: 'worker-2',
        leaseMs: 60_000,
      });
      assert.ok(secondLease);
      assert.deepStrictEqual(secondLease.run.regenerateDimensionIds, [
        'balance',
        'meaning',
      ]);
      // The claimed run is the newest row and has no result of its own; the
      // map it amends is still the one it amends.
      assert.deepStrictEqual(
        await repo.findLatestResultByRoundId(roundId),
        stored,
      );
    } finally {
      await prisma.organization.delete({ where: { id: organizationId } });
    }
  },
);

test(
  'PostgreSQL names the workers whose leases are alive and forgets the rest',
  { skip: !connectionString },
  async () => {
    assert.ok(prisma);
    const suffix = globalThis.crypto.randomUUID();
    const alive = `worker-alive-${suffix}`;
    const stopped = `worker-stopped-${suffix}`;
    // Two schools rather than two rounds of one: a school may hold exactly one
    // active round, and two workers analysing at once is by definition two
    // schools closing together.
    const organizationIds = [`org-ai-fleet-a-${suffix}`, `org-ai-fleet-b-${suffix}`];
    const roundIds = [`round-ai-fleet-a-${suffix}`, `round-ai-fleet-b-${suffix}`];
    for (const [index, organizationId] of organizationIds.entries()) {
      await prisma.organization.create({
        data: {
          id: organizationId,
          name: `AI fleet integration test ${index}`,
          city: 'local',
          schoolType: 'test',
          totalStaffCount: 10,
        },
      });
      await prisma.surveyRound.create({
        data: {
          id: roundIds[index],
          organizationId,
          title: `Fleet ${index}`,
          status: 'active',
          shareCode: `AI-FLEET-${index}-${suffix}`,
          privacyThreshold: 10,
        },
      });
    }

    try {
      const repo = new PrismaAiAnalysisRunRepository(prisma as any);
      for (const roundId of roundIds) {
        await repo.enqueue(roundId, {
          requestKey: 'automatic',
          trigger: 'automatic',
        });
      }
      const first = await repo.claimNext({ workerId: alive, leaseMs: 60_000 });
      const second = await repo.claimNext({
        workerId: stopped,
        leaseMs: 60_000,
      });
      assert.ok(first && second);

      // Only the ids this test created: the read is deliberately platform-wide
      // — every worker on the key is a sender, whatever school it is analysing
      // — so a suite that shares a database must narrow the answer itself.
      const mine = async () =>
        (await repo.readLiveWorkerIds(32))
          .filter((workerId) => workerId.endsWith(suffix))
          .sort();

      assert.deepStrictEqual(await mine(), [alive, stopped].sort());

      // The second worker stops without saying so, which is what a killed
      // container looks like from here: the row stays `running` and only the
      // lease runs out.
      await prisma.aiAnalysisRun.update({
        where: { id: second.run.id },
        data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
      });
      assert.deepStrictEqual(
        await mine(),
        [alive],
        'a worker is only counted while its lease is alive',
      );

      // A finished run releases its worker id, so a process between rounds is
      // not counted as one that is sending.
      assert.strictEqual(
        await repo.finish(first.run.id, {
          state: 'failed',
          leaseToken: first.leaseToken,
          failureCode: 'worker_error',
        }),
        'transitioned',
      );
      assert.deepStrictEqual(await mine(), []);
    } finally {
      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
    }
  },
);
