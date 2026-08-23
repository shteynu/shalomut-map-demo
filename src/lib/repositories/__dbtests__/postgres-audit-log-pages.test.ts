/**
 * The durable log hands back the same page the ephemeral one does.
 *
 * `an-audit-log-is-read-in-pages.test.ts` states what a page is against the
 * in-memory store. This asks PostgreSQL the half that suite cannot: whether the
 * `where` clause the cursor compiles to actually orders and cuts the same way a
 * sort and a slice do. The two stores are read by the same service, and the one
 * no fast suite runs against is the one behind the deployed screen.
 *
 * The tie on `timestamp` is the case worth having a database for. In memory it
 * is a comparison; in PostgreSQL it is an `OR` of two predicates against a
 * column stored with more precision than a JavaScript `Date` carries.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import {
  DEFAULT_AUDIT_LOG_PAGE_SIZE,
  InMemoryAuditLogRepository,
  MAXIMUM_AUDIT_LOG_PAGE_SIZE,
  type AuditLogCursor,
  type IAuditLogRepository,
} from '../../auth/domain-contract';
import type { AuditEvent } from '../../auth/types';
import { PrismaAuditLogRepository } from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'TEST_DATABASE_URL is required for the PostgreSQL suite. ' +
      'Run it through `npm run verify:db`, which supplies one.',
  );
}

let pool: { end: () => Promise<void> };
let prisma: MinimalPrismaClient & { $disconnect?: () => Promise<void> };

const EPOCH = new Date('2026-08-01T00:00:00.000Z');
let organizationId: string;

function event(index: number, overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: `evt-${String(index).padStart(4, '0')}`,
    timestamp: new Date(EPOCH.getTime() + index * 1000),
    action: 'SETUP_SAVED',
    managerId: 'mgr-cohen',
    organizationId,
    details: { updatedFields: ['title'] },
    ...overrides,
  };
}

/** Every page, walked with the cursor the caller is expected to build. */
async function walk(
  repo: IAuditLogRepository,
  limit: number,
): Promise<string[]> {
  const seen: string[] = [];
  let cursor: AuditLogCursor | undefined;

  for (let page = 0; page < 50; page += 1) {
    const events = await repo.findByOrganizationId(organizationId, {
      limit,
      after: cursor,
    });
    if (events.length === 0) return seen;
    seen.push(...events.map((entry) => entry.id));
    const last = events[events.length - 1];
    cursor = { timestamp: last.timestamp, id: last.id };
  }

  throw new Error('the walk did not terminate, which is a cursor that stalled');
}

/** The same events in both stores, so a difference is the store and not the data. */
async function writeToBoth(
  events: readonly AuditEvent[],
): Promise<{ durable: IAuditLogRepository; ephemeral: IAuditLogRepository }> {
  const durable = new PrismaAuditLogRepository(prisma);
  const ephemeral = new InMemoryAuditLogRepository();
  for (const entry of events) {
    await durable.recordEvent(entry);
    await ephemeral.recordEvent(entry);
  }
  return { durable, ephemeral };
}

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  await prisma.auditEvent?.deleteMany({});
  organizationId = randomUUID();
});

test('the durable read is bounded even when the caller asks for nothing', async () => {
  const events = Array.from({ length: DEFAULT_AUDIT_LOG_PAGE_SIZE + 25 }, (_, i) =>
    event(i),
  );
  const { durable } = await writeToBoth(events);

  const page = await durable.findByOrganizationId(organizationId);

  assert.strictEqual(page.length, DEFAULT_AUDIT_LOG_PAGE_SIZE);
  assert.strictEqual(
    page[0].id,
    events[events.length - 1].id,
    'newest first, which is the direction the cursor then walks',
  );
});

test('both stores walk the same log in the same order', async () => {
  const events = Array.from({ length: 40 }, (_, index) => event(index));
  const { durable, ephemeral } = await writeToBoth(events);

  const fromDatabase = await walk(durable, 9);
  const fromMemory = await walk(ephemeral, 9);

  assert.deepStrictEqual(
    fromDatabase,
    [...events].reverse().map((entry) => entry.id),
    'every event exactly once, newest first',
  );
  assert.deepStrictEqual(fromDatabase, fromMemory);
});

test('events sharing a timestamp are all on the walk, in both stores', async () => {
  // Three administrators acting in the same millisecond. A cursor of
  // `timestamp < last` would step over whichever of them fell after the page
  // boundary — silently, and only ever at the busiest instant in the log.
  const sameMoment = new Date(EPOCH.getTime() + 5000);
  const events = ['evt-a', 'evt-b', 'evt-c', 'evt-d'].map((id) =>
    event(0, { id, timestamp: sameMoment }),
  );
  const { durable, ephemeral } = await writeToBoth(events);

  const fromDatabase = await walk(durable, 2);

  assert.deepStrictEqual(fromDatabase, ['evt-d', 'evt-c', 'evt-b', 'evt-a']);
  assert.deepStrictEqual(fromDatabase, await walk(ephemeral, 2));
});

test('a page never reaches past the school it was asked about', async () => {
  const mine = [event(1), event(3)];
  const foreign = event(2, { id: 'evt-foreign', organizationId: randomUUID() });
  const { durable } = await writeToBoth([...mine, foreign]);

  const page = await durable.findByOrganizationId(organizationId, {
    limit: MAXIMUM_AUDIT_LOG_PAGE_SIZE,
    after: { timestamp: new Date(EPOCH.getTime() + 9000), id: 'evt-9999' },
  });

  assert.deepStrictEqual(
    page.map((entry) => entry.id),
    ['evt-0003', 'evt-0001'],
  );
});

test('a limit above the maximum is clamped by the store, not trusted', async () => {
  // The clamp is shared code, but the value that reaches `take` is this
  // repository's, and a repository that passed the request through would be
  // unbounded again with one query parameter.
  const events = Array.from({ length: MAXIMUM_AUDIT_LOG_PAGE_SIZE + 5 }, (_, i) =>
    event(i),
  );
  const { durable } = await writeToBoth(events);

  const page = await durable.findByOrganizationId(organizationId, {
    limit: 100_000,
  });

  assert.strictEqual(page.length, MAXIMUM_AUDIT_LOG_PAGE_SIZE);
});
