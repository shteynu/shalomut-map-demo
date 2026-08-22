/**
 * What a status write reports when it does not happen.
 *
 * `updateStatus` used to answer `SurveyRound | null` and catch every error into
 * that `null`, so a round that was gone, a school that already had a running
 * round, a transition that raced another request and a dropped connection were
 * one indistinguishable outcome. Callers then treated it as none of them. These
 * hold each outcome apart at the repository, where the distinction is made, and
 * hold both implementations to the same answers.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryRoundRepository } from '../in-memory/in-memory-round.repository';
import { PrismaRoundRepository } from '../prisma/prisma-round.repository';
import type { MinimalPrismaClient } from '../prisma/prisma-client';
import type { RoundStatus, SurveyRound } from '../../types/backend';

const ONE_ACTIVE_ROUND_INDEX = 'survey_rounds_one_active_per_organization';

function round(
  id: string,
  status: RoundStatus,
  organizationId = 'org-1',
): SurveyRound {
  return {
    id,
    organizationId,
    title: id,
    status,
    shareCode: `SHALOM-${id.toUpperCase()}`,
    privacyThreshold: 10,
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  };
}

/**
 * A client that answers only what a status write asks it, so each test decides
 * exactly what the database does. The shared mock in `prisma.test.ts` models a
 * working database; what is under test here is what happens when it refuses.
 *
 * `updateMany` honours its `where` rather than reporting a fixed count. That is
 * deliberate: the fix is a `WHERE` clause, and a mock that ignored it would let
 * the clause be deleted with every test still passing — which is exactly what
 * happened the first time these were written.
 */
function clientThat({
  rows = [] as SurveyRound[],
  updateManyThrows = undefined as unknown,
}: {
  rows?: SurveyRound[];
  updateManyThrows?: unknown;
}): MinimalPrismaClient {
  const stored = new Map(rows.map((entry) => [entry.id, { ...entry }]));

  return {
    surveyRound: {
      create: async () => {
        throw new Error('not used');
      },
      findUnique: async ({ where }: any) => stored.get(where.id) ?? null,
      findFirst: async ({ where }: any) =>
        Array.from(stored.values()).find(
          (entry) =>
            entry.organizationId === where.organizationId &&
            entry.status === where.status &&
            entry.id !== where.NOT?.id,
        ) ?? null,
      findMany: async () => Array.from(stored.values()),
      update: async () => {
        throw new Error('not used');
      },
      updateMany: async ({ where, data }: any) => {
        if (updateManyThrows) throw updateManyThrows;

        const target = stored.get(where.id);
        if (!target) return { count: 0 };
        if (where.status !== undefined && target.status !== where.status) {
          return { count: 0 };
        }

        stored.set(where.id, { ...target, ...data });
        return { count: 1 };
      },
      deleteMany: async () => ({ count: 0 }),
    },
  } as unknown as MinimalPrismaClient;
}

function uniqueViolation(meta: Record<string, unknown>) {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta,
  });
}

test('a round that moved since the read is not written over', async () => {
  // The load-bearing case. The round was archived while this request still
  // believed it was active; the expected status travels into the `WHERE`, so
  // the write matches nothing instead of pulling an archived round back to
  // `closed` — a transition no rule allows.
  const client = clientThat({ rows: [round('r1', 'archived')] });
  const repo = new PrismaRoundRepository(client);

  const write = await repo.updateStatus('r1', 'closed', 'active');

  assert.equal(write.outcome, 'status_changed');
  assert.equal(
    write.outcome === 'status_changed' ? write.current : null,
    'archived',
  );
  assert.equal(
    (await client.surveyRound.findUnique({ where: { id: 'r1' } })).status,
    'archived',
  );
});

test('a write whose expectation still holds goes through', async () => {
  const repo = new PrismaRoundRepository(
    clientThat({ rows: [round('r1', 'active')] }),
  );

  const write = await repo.updateStatus('r1', 'closed', 'active');

  assert.equal(write.outcome, 'written');
  assert.equal(write.outcome === 'written' ? write.round.status : null, 'closed');
});

test('a write that matched nothing because the round is gone says so', async () => {
  const repo = new PrismaRoundRepository(clientThat({ rows: [] }));

  const write = await repo.updateStatus('r1', 'closed', 'active');

  assert.equal(write.outcome, 'not_found');
});

test('the one-active-round index is reported as the round that is running', async () => {
  const running = round('running', 'active');
  const repo = new PrismaRoundRepository(
    clientThat({
      rows: [round('r1', 'closed'), running],
      updateManyThrows: uniqueViolation({ target: ONE_ACTIVE_ROUND_INDEX }),
    }),
  );

  const write = await repo.updateStatus('r1', 'active', 'closed');

  assert.equal(write.outcome, 'another_round_is_active');
  assert.equal(
    write.outcome === 'another_round_is_active'
      ? write.activeRound?.id
      : null,
    'running',
  );
});

test('the shape the adapter actually throws is read', async () => {
  // Copied from a real refusal observed through `npm run verify:db`, not
  // invented: the adapter leaves `meta.target` undefined and reports the
  // columns rather than the index, naming it only inside the driver's message.
  // The first version of this reader looked for `constraint.index` and called
  // the real refusal an unknown write failure — the database suite is what
  // caught it, and this test is what keeps the shape written down.
  const repo = new PrismaRoundRepository(
    clientThat({
      rows: [round('r1', 'closed'), round('running', 'active')],
      updateManyThrows: uniqueViolation({
        modelName: 'SurveyRound',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '23505',
            originalMessage: `duplicate key value violates unique constraint "${ONE_ACTIVE_ROUND_INDEX}"`,
            kind: 'UniqueConstraintViolation',
            constraint: { fields: ['organization_id'] },
          },
        },
      }),
    }),
  );

  const write = await repo.updateStatus('r1', 'active', 'closed');

  assert.equal(write.outcome, 'another_round_is_active');
  assert.equal(
    write.outcome === 'another_round_is_active' ? write.activeRound?.id : null,
    'running',
  );
});

test('a unique violation on some other constraint stays a write failure', async () => {
  // Mapping an unrecognised constraint to "another round is active" would
  // explain a real defect away in the manager's own words.
  const repo = new PrismaRoundRepository(
    clientThat({
      rows: [round('r1', 'closed')],
      updateManyThrows: uniqueViolation({
        driverAdapterError: {
          cause: {
            originalMessage:
              'duplicate key value violates unique constraint "survey_rounds_share_code_key"',
            constraint: { fields: ['share_code'] },
          },
        },
      }),
    }),
  );

  const write = await repo.updateStatus('r1', 'active', 'closed');

  assert.equal(write.outcome, 'write_failed');
});

test('a dropped connection is a write failure carrying its reason', async () => {
  const repo = new PrismaRoundRepository(
    clientThat({
      rows: [round('r1', 'active')],
      updateManyThrows: new Error('Connection terminated unexpectedly'),
    }),
  );

  const write = await repo.updateStatus('r1', 'closed', 'active');

  assert.equal(write.outcome, 'write_failed');
  assert.match(
    write.outcome === 'write_failed' ? write.reason : '',
    /Connection terminated/,
  );
});

test('the in-memory repository refuses a stale expectation and changes nothing', async () => {
  const repo = new InMemoryRoundRepository([round('r1', 'closed')]);

  const write = await repo.updateStatus('r1', 'archived', 'active');

  assert.equal(write.outcome, 'status_changed');
  assert.equal((await repo.findById('r1'))?.status, 'closed');
});

test('the in-memory repository enforces one running round per school', async () => {
  // The same rule the partial unique index holds in PostgreSQL. Nearly every
  // test of a refused activation runs against this class, and one that could
  // not refuse would prove the handling works by never reaching it.
  const repo = new InMemoryRoundRepository([
    round('ours', 'closed'),
    round('running', 'active'),
    round('theirs', 'active', 'org-2'),
  ]);

  const refused = await repo.updateStatus('ours', 'active', 'closed');
  assert.equal(refused.outcome, 'another_round_is_active');
  assert.equal(
    refused.outcome === 'another_round_is_active'
      ? refused.activeRound?.id
      : null,
    'running',
  );

  // Another school's active round is not this school's business.
  const allowed = await new InMemoryRoundRepository([
    round('ours', 'closed'),
    round('theirs', 'active', 'org-2'),
  ]).updateStatus('ours', 'active', 'closed');
  assert.equal(allowed.outcome, 'written');
});
