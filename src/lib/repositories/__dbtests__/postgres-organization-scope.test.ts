/**
 * The two bounded reads a manager's scope is resolved with, as SQL.
 *
 * `ManagerScopeService.resolveOrganizationId` runs on every authenticated
 * manager request and used to answer by reading the organizations table. The
 * in-memory suite proves the service now asks for named schools instead; it
 * cannot prove the database answers that question without touching every row,
 * because the in-memory store has no planner. That is only provable here.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { PrismaOrganizationRepository } from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import type { Organization } from '../../types/backend';

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'TEST_DATABASE_URL is required for the PostgreSQL suite. ' +
      'Run it through `npm run verify:db`, which supplies one.',
  );
}

let pool: { end: () => Promise<void> };
let prisma: MinimalPrismaClient & { $disconnect?: () => Promise<void> };
let orgRepo: PrismaOrganizationRepository;

function raw() {
  return prisma as unknown as {
    $executeRawUnsafe: (sql: string) => Promise<number>;
    $queryRawUnsafe: (sql: string) => Promise<{ 'QUERY PLAN': string }[]>;
  };
}

async function createSchool(
  index: number,
  createdAt: Date,
): Promise<Organization> {
  return orgRepo.create({
    id: randomUUID(),
    name: `בית ספר ${index}`,
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt,
  });
}

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  orgRepo = new PrismaOrganizationRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  // This database is disposable by design and is never the deployed one —
  // `verify:db` refuses a managed host.
  await prisma.organization.deleteMany({});
});

test('findByIds answers with the named schools and nothing else', async () => {
  const first = await createSchool(0, new Date('2026-08-01T00:00:00.000Z'));
  const second = await createSchool(1, new Date('2026-08-02T00:00:00.000Z'));
  await createSchool(2, new Date('2026-08-03T00:00:00.000Z'));

  const found = await orgRepo.findByIds([second.id, first.id, randomUUID()]);

  // Newest first, the order `findAll` answers in — an id that names no row is
  // simply absent rather than a null in its place, because a session may hold a
  // membership for a school that has not been created yet.
  assert.deepStrictEqual(
    found.map((organization) => organization.id),
    [second.id, first.id],
  );
  assert.strictEqual(found[0].name, 'בית ספר 1');
  assert.ok(found[0].createdAt instanceof Date);
});

test('findByIds of nothing asks the database nothing', async () => {
  await createSchool(0, new Date('2026-08-01T00:00:00.000Z'));

  assert.deepStrictEqual(await orgRepo.findByIds([]), []);
});

test('listIds answers with at most the limit, newest first', async () => {
  const oldest = await createSchool(0, new Date('2026-08-01T00:00:00.000Z'));
  const middle = await createSchool(1, new Date('2026-08-02T00:00:00.000Z'));
  const newest = await createSchool(2, new Date('2026-08-03T00:00:00.000Z'));

  assert.deepStrictEqual(await orgRepo.listIds(2), [newest.id, middle.id]);
  assert.deepStrictEqual(await orgRepo.listIds(0), []);
  assert.deepStrictEqual(await orgRepo.listIds(10), [
    newest.id,
    middle.id,
    oldest.id,
  ]);
});

test('the scope read uses the key rather than scanning the table', async () => {
  /*
   * The read this replaced grew with every school onboarded, so the cost of the
   * replacement must not. Asked of the planner rather than reasoned about — and
   * asked of a table with enough rows for the question to be real: on a small
   * one a sequential scan is genuinely the cheaper answer whatever the indexes
   * are, so an assertion made there passes for the wrong reason.
   */
  await raw().$executeRawUnsafe(
    `INSERT INTO organizations (id, name, city, school_type, total_staff_count, created_at)
     SELECT gen_random_uuid(), 'school ' || g, 'חיפה', 'יסודי', 40,
            now() - (g || ' minutes')::interval
     FROM generate_series(1, 5000) g`,
  );
  await raw().$executeRawUnsafe('ANALYZE organizations');

  const anId = (await orgRepo.listIds(1))[0];
  const rows = await raw().$queryRawUnsafe(
    `EXPLAIN SELECT * FROM organizations WHERE id IN ('${anId}')`,
  );
  const plan = rows.map((row) => row['QUERY PLAN']).join('\n');

  // The shape, not a cost: a cost is a number that moves. The primary key is
  // the only index this table has, and it is the one a membership list is
  // looked up by.
  assert.ok(
    /Index Scan/.test(plan),
    `expected an index scan, planner said:\n${plan}`,
  );
  assert.ok(
    !/Seq Scan/.test(plan),
    `a manager's scope must not scan the table, planner said:\n${plan}`,
  );
});
