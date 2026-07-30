import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaAiAnalysisRunRepository } from '../prisma/prisma-ai-analysis-run.repository';

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
