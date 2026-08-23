/**
 * The administrator console's page, its search and its two people lists,
 * against a real PostgreSQL.
 *
 * Three of these questions cannot be asked of the in-memory twin at all, and
 * the twin passes them by not having them:
 *
 * 1. `contains` compiles to `ILIKE '%value%'` and Prisma escapes nothing inside
 *    `value`. A `Map` has no pattern language, so a search for `%` matches
 *    nothing there whatever the repository does. Here it matches everything
 *    unless the repository escapes it first — the same reading of `ILIKE` that
 *    ADR-044 found underneath the share code, arriving this time as a wrong
 *    answer rather than as a way past a gate.
 * 2. `skip`/`take` are `OFFSET`/`LIMIT`, and an `ORDER BY` that does not
 *    determine a total order lets PostgreSQL return rows in any order it likes
 *    — so two adjacent pages may repeat a school and lose another. Schools
 *    created in the same millisecond, which the seed does, are exactly that
 *    case.
 * 3. `memberships: { none: … }` is a `NOT EXISTS` subquery. It is the whole
 *    reason "who has no school" is asked of the database instead of derived
 *    from what the screen happens to have loaded.
 *
 * Outside `__tests__` like the rest of the PostgreSQL suite: `npm test` stays
 * runnable without a database, and `npm run verify:db` supplies a disposable
 * one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { PrismaManagerRepository, PrismaOrganizationRepository } from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import type { MembershipStatus } from '../../auth/types';

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
let managerRepo: PrismaManagerRepository;

async function createSchool(
  name: string,
  city = 'חיפה',
  createdAt = new Date(),
): Promise<string> {
  const id = randomUUID();
  await orgRepo.create({
    id,
    name,
    city,
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt,
  });
  return id;
}

async function createManager(
  email: string,
  isPlatformAdministrator = false,
): Promise<string> {
  const id = randomUUID();
  await managerRepo.saveManager({
    id,
    email,
    name: email,
    isPlatformAdministrator,
    createdAt: new Date(),
  });
  return id;
}

async function attach(
  managerId: string,
  organizationId: string,
  status: MembershipStatus,
): Promise<void> {
  await managerRepo.saveMembership({
    id: randomUUID(),
    managerId,
    organizationId,
    role: 'manager',
    status,
    createdAt: new Date(),
  });
}

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  orgRepo = new PrismaOrganizationRepository(prisma);
  managerRepo = new PrismaManagerRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  await prisma.organization.deleteMany({});
  await prisma.manager?.deleteMany({});
});

test('a page is one page, and the total is the whole list behind it', async () => {
  for (let index = 0; index < 25; index += 1) {
    await createSchool(`בית ספר ${index}`);
  }

  const page = await orgRepo.findPage({ skip: 0, take: 20 });

  assert.strictEqual(page.organizations.length, 20);
  assert.strictEqual(page.total, 25);
});

test('the pages together are every school, each exactly once', async () => {
  // Every row shares one creation instant, which is the case a single-column
  // `ORDER BY created_at DESC` does not determine an order for. Without the
  // `id` tie-break, `OFFSET 20` is free to hand back rows the first page
  // already showed — the classic paging defect, and one that only appears
  // against a real planner.
  const sameInstant = new Date('2026-08-23T09:00:00.000Z');
  const created: string[] = [];
  for (let index = 0; index < 45; index += 1) {
    created.push(await createSchool(`בית ספר ${index}`, 'חיפה', sameInstant));
  }

  const seen: string[] = [];
  for (const skip of [0, 20, 40]) {
    const page = await orgRepo.findPage({ skip, take: 20 });
    seen.push(...page.organizations.map((organization) => organization.id));

    /*
     * An administrator paging a list is also an administrator acting on it, and
     * every write here is one they can perform: renaming a school, inviting
     * somebody, revoking access. PostgreSQL rewrites the row on `UPDATE` and
     * the new version lands at the end of the heap, so the next sequential scan
     * reads it in a different position — and with equal sort keys and no
     * tie-break, a different position is a different page.
     *
     * Without this the test passes whether or not the tie-break is there: 45
     * untouched rows come back the same way twice, and the query looks
     * deterministic because nothing has disturbed it. That was measured, not
     * assumed — the tie-break was removed and the test still passed.
     */
    for (const organization of page.organizations) {
      await orgRepo.update(organization.id, { name: `${organization.name}!` });
    }
  }

  assert.strictEqual(seen.length, 45);
  assert.strictEqual(new Set(seen).size, 45, 'a school was repeated across pages');
  assert.deepStrictEqual(seen.slice().sort(), created.slice().sort());
});

test('a search matches the name or the city, in either case', async () => {
  const gordon = await createSchool('Gordon', 'תל אביב');
  await createSchool('בית ספר צפון', 'חיפה');

  const byName = await orgRepo.findPage({ search: 'gOrDoN', skip: 0, take: 20 });
  assert.deepStrictEqual(
    byName.organizations.map((organization) => organization.id),
    [gordon],
  );

  const byCity = await orgRepo.findPage({ search: 'תל', skip: 0, take: 20 });
  assert.deepStrictEqual(
    byCity.organizations.map((organization) => organization.id),
    [gordon],
  );
});

test('a per-cent sign in the search is a per-cent sign', async () => {
  // Unescaped, this is `ILIKE '%%%'` and matches every school on the platform.
  await createSchool('בית ספר א');
  await createSchool('בית ספר ב');
  const literal = await createSchool('100% נוכחות');

  const wildcard = await orgRepo.findPage({ search: '%', skip: 0, take: 20 });
  assert.deepStrictEqual(
    wildcard.organizations.map((organization) => organization.id),
    [literal],
  );
  assert.strictEqual(
    wildcard.total,
    1,
    'the count is asked with the same `where`, so an unescaped search inflates it too',
  );
});

test('an underscore in the search is an underscore', async () => {
  // The quieter half of the same defect: `_` is a single-character wildcard, so
  // an unescaped one matches names that merely have the right length.
  await createSchool('בית ספר אב');
  const literal = await createSchool('a_b');

  const found = await orgRepo.findPage({ search: '_', skip: 0, take: 20 });

  assert.deepStrictEqual(
    found.organizations.map((organization) => organization.id),
    [literal],
  );
});

test('a search that matches nothing is an empty page, not the whole table', async () => {
  await createSchool('בית ספר צפון');

  const found = await orgRepo.findPage({
    search: 'no-such-school',
    skip: 0,
    take: 20,
  });

  assert.deepStrictEqual(found.organizations, []);
  assert.strictEqual(found.total, 0);
});

test('who has no standing membership is decided by the database', async () => {
  const school = await createSchool('בית ספר צפון');
  const other = await createSchool('בית ספר דרום');

  const active = await createManager('active@school.ac.il');
  const invited = await createManager('invited@school.ac.il');
  const revoked = await createManager('revoked@school.ac.il');
  const never = await createManager('never@school.ac.il');
  await createManager('admin@shalomut.example', true);

  await attach(active, school, 'active');
  await attach(invited, other, 'invited');
  // A revoked membership is a row that exists and does not stand — the exact
  // case a `NOT EXISTS` over all memberships would get wrong.
  await attach(revoked, school, 'suspended');

  const found = await managerRepo.findManagersWithoutStandingMembership(50);

  assert.deepStrictEqual(
    found.map((manager) => manager.id).sort(),
    [revoked, never].sort(),
  );
});

test('the platform administrators are a list, and only the administrators', async () => {
  const first = await createManager('one@shalomut.example', true);
  const second = await createManager('two@shalomut.example', true);
  await createManager('school@school.ac.il');

  const found = await managerRepo.findPlatformAdministrators(50);

  assert.deepStrictEqual(
    found.map((manager) => manager.id).sort(),
    [first, second].sort(),
  );
});

test('a limit is a limit, and zero asks nothing', async () => {
  for (let index = 0; index < 5; index += 1) {
    await createManager(`person${index}@school.ac.il`);
  }

  assert.strictEqual(
    (await managerRepo.findManagersWithoutStandingMembership(3)).length,
    3,
  );
  assert.deepStrictEqual(
    await managerRepo.findManagersWithoutStandingMembership(0),
    [],
  );
  assert.deepStrictEqual(await managerRepo.findPlatformAdministrators(0), []);
});

test('the page names its people, and no ids means no query', async () => {
  const school = await createSchool('בית ספר צפון');
  const here = await createManager('here@school.ac.il');
  await createManager('elsewhere@school.ac.il');
  await attach(here, school, 'active');

  const found = await managerRepo.findManagersByIds([here]);
  assert.deepStrictEqual(
    found.map((manager) => manager.email),
    ['here@school.ac.il'],
  );

  // An empty page has no people to name, and `IN ()` is a different question
  // rather than a smaller one.
  assert.deepStrictEqual(await managerRepo.findManagersByIds([]), []);
});
