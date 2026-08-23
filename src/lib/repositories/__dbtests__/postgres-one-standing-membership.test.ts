/**
 * The partial unique index that makes "one school, one person" true.
 *
 * `inviteSchoolUser` and `setMembershipStatus` both read the school's
 * memberships before writing, and the 2026-08-21 audit named what that leaves
 * open: two requests that read before either writes both pass the check. A
 * single process cannot lose that race, so the in-memory suite
 * (`src/lib/auth/__tests__/the-store-refuses-a-second-school-user.test.ts`)
 * proves the refusal and the reporting and stops there.
 *
 * This runs the two inserts at PostgreSQL at once and asks which one it keeps.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { SchoolAlreadyHasSomebodyError } from '../../auth/domain-contract';
import type { OrganizationMembership } from '../../auth/types';
import { PrismaManagerRepository, PrismaOrganizationRepository } from '..';
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

let organizationId: string;
let otherOrganizationId: string;

function managers() {
  return new PrismaManagerRepository(prisma);
}

/** A person who exists, so the membership's foreign key has something to hold. */
async function person(name: string) {
  const manager = await managers().saveManager({
    id: randomUUID(),
    email: `${randomUUID()}@school.ac.il`,
    name,
    isPlatformAdministrator: false,
    createdAt: new Date(),
  });
  return manager.id;
}

function membership(
  managerId: string,
  overrides: Partial<OrganizationMembership> = {},
): OrganizationMembership {
  return {
    id: randomUUID(),
    managerId,
    organizationId,
    role: 'manager',
    status: 'invited',
    createdAt: new Date(),
    ...overrides,
  };
}

/** How many of this school's memberships stand, read from the database. */
async function standing(id = organizationId) {
  const rows = await managers().findMembershipsByOrganizationId(id);
  return rows.filter((row) => row.status === 'active' || row.status === 'invited')
    .length;
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
  // Cascades reach the memberships. This database is disposable by design and
  // is never the deployed one — `verify:db` refuses a managed host.
  await prisma.organization.deleteMany({});
  await prisma.manager?.deleteMany({});

  organizationId = randomUUID();
  otherOrganizationId = randomUUID();

  const orgRepo = new PrismaOrganizationRepository(prisma);
  for (const [id, name] of [
    [organizationId, 'בית ספר שלום'],
    [otherOrganizationId, 'בית ספר אחר'],
  ] as const) {
    await orgRepo.create({
      id,
      name,
      city: 'חיפה',
      schoolType: 'יסודי',
      totalStaffCount: 40,
      createdAt: new Date(),
    });
  }
});

test('two invitations racing for one school leave exactly one standing', async () => {
  // The race itself, which is the thing no read can prevent and the only thing
  // this file exists to prove. Both writes are dispatched before either
  // completes, so neither could have seen the other.
  const [first, second] = await Promise.all([person('ראשונה'), person('שני')]);

  const outcomes = await Promise.allSettled([
    managers().saveMembership(membership(first)),
    managers().saveMembership(membership(second)),
  ]);

  const kept = outcomes.filter((outcome) => outcome.status === 'fulfilled');
  const refused = outcomes.filter((outcome) => outcome.status === 'rejected');

  assert.strictEqual(kept.length, 1, 'exactly one write may be kept');
  assert.strictEqual(refused.length, 1);
  assert.ok(
    (refused[0] as PromiseRejectedResult).reason instanceof
      SchoolAlreadyHasSomebodyError,
    'the loser gets the domain refusal, not a raw P2002 — that translation is ' +
      'what lets the caller answer with the same message the read gives',
  );
  assert.strictEqual(await standing(), 1);
});

test('a suspended row does not stand, so the next person can be invited', async () => {
  // The negative control for the index's `WHERE`. A school changes hands by
  // revoke-then-invite, so revoked rows accumulate; an index that counted them
  // would make a school unusable after its first handover.
  const previous = await person('קודמת');
  await managers().saveMembership(
    membership(previous, { status: 'suspended' }),
  );
  const older = await person('עוד יותר קודם');
  await managers().saveMembership(membership(older, { status: 'suspended' }));

  const next = await person('נוכחית');
  await managers().saveMembership(membership(next));

  assert.strictEqual(await standing(), 1);
});

test('accepting an invitation is the same row and is not refused', async () => {
  // `invited` and `active` both stand, so this write moves a row from one side
  // of the index to the other without changing the count. It happens every
  // time an invited person signs in, and an index that refused it would lock
  // every school out on first use.
  const invitee = await person('מוזמנת');
  const invited = await managers().saveMembership(membership(invitee));

  const accepted = await managers().saveMembership({
    ...invited,
    status: 'active',
  });

  assert.strictEqual(accepted.status, 'active');
  assert.strictEqual(await standing(), 1);
});

test('the index is per school, not global', async () => {
  const here = await person('כאן');
  const there = await person('שם');

  await managers().saveMembership(membership(here));
  await managers().saveMembership(
    membership(there, { organizationId: otherOrganizationId }),
  );

  assert.strictEqual(await standing(), 1);
  assert.strictEqual(await standing(otherOrganizationId), 1);
});

test('a revoked person can be restored once the school is free again', async () => {
  // The whole handover cycle, end to end, because each step above is only half
  // of it: invite, revoke, invite somebody else, revoke them, restore the
  // first. Every state the index sees, in the order the product produces them.
  const first = await person('ראשונה');
  const invited = await managers().saveMembership(membership(first));
  await managers().saveMembership({ ...invited, status: 'suspended' });

  const second = await person('שנייה');
  const secondMembership = await managers().saveMembership(membership(second));
  assert.strictEqual(await standing(), 1);

  await managers().saveMembership({ ...secondMembership, status: 'suspended' });
  assert.strictEqual(await standing(), 0);

  await managers().saveMembership({ ...invited, status: 'active' });
  assert.strictEqual(await standing(), 1);
});
