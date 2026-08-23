/**
 * An administrative change nobody recorded did not happen.
 *
 * The 2026-08-21 audit found the membership route writing first and recording
 * afterwards, outside any transaction: an audit insert that failed left the
 * membership changed, answered 500, and left nothing behind saying who changed
 * it. The owner decided on 2026-08-23 that these audits are mandatory rather
 * than best effort, which settles what the fix has to be — the change and its
 * record commit together or neither does.
 *
 * `src/app/api/admin/__tests__/admin-routes.test.ts` proves the reporting and
 * reproduces the divergence on purpose: `runInTransaction` with no database
 * calls the work with the ephemeral repositories, and a `Map` has nothing to
 * roll back. This asks PostgreSQL the half that suite cannot.
 *
 * The audit insert is made to fail the way a real one would: a NUL byte (`\u0000`) in
 * the event's `details`, which PostgreSQL refuses in `jsonb`. It is not synthetic —
 * `details` carries names and e-mail addresses that arrive from a form.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { runInTransaction } from '../../composition-root';
import { ManagerAdministrationService } from '../../auth/manager-administration-service';
import type { AuditEvent } from '../../auth/types';
import { PrismaAuditLogRepository, PrismaManagerRepository, PrismaOrganizationRepository } from '..';
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

function managers() {
  return new PrismaManagerRepository(prisma);
}

function audit() {
  return new PrismaAuditLogRepository(prisma);
}

/** An event PostgreSQL will take, and the same one it will not. */
function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: randomUUID(),
    timestamp: new Date(),
    action: 'MEMBER_REVOKED',
    managerId: 'mgr-administrator',
    organizationId,
    details: { email: 'principal@school.ac.il' },
    ...overrides,
  };
}

const UNSTORABLE_DETAILS = { email: 'principal\u0000@school.ac.il' };

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
  await prisma.auditEvent?.deleteMany({});

  organizationId = randomUUID();
  await new PrismaOrganizationRepository(prisma).create({
    id: organizationId,
    name: 'בית ספר לבדיקת ביקורת',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });
});

test('the database really does refuse the event this file fails on', async () => {
  // Everything below is worthless if the audit insert quietly succeeds, so the
  // premise is checked first rather than assumed.
  await assert.rejects(
    () => audit().recordEvent(event({ details: UNSTORABLE_DETAILS })),
    'a NUL byte in details must be refused, or these tests prove nothing',
  );
  assert.deepStrictEqual(await audit().findByOrganizationId(organizationId), []);
});

test('a membership change whose record cannot be written does not stand', async () => {
  const invited = await runInTransaction(
    async ({ managerRepo }) => {
      const manager = await managerRepo.saveManager({
        id: randomUUID(),
        email: 'principal@school.ac.il',
        name: 'מנהלת',
        isPlatformAdministrator: false,
        createdAt: new Date(),
      });
      return managerRepo.saveMembership({
        id: randomUUID(),
        managerId: manager.id,
        organizationId,
        role: 'manager',
        status: 'invited',
        createdAt: new Date(),
      });
    },
    prisma,
  );

  await assert.rejects(() =>
    runInTransaction(async ({ auditLogRepo, managerRepo }) => {
      await managerRepo.saveMembership({ ...invited, status: 'suspended' });
      await auditLogRepo.recordEvent(event({ details: UNSTORABLE_DETAILS }));
    }, prisma),
  );

  const [stored] = await managers().findMembershipsByOrganizationId(organizationId);
  assert.strictEqual(
    stored.status,
    'invited',
    'the revocation must be undone with the record that could not be written',
  );
  assert.deepStrictEqual(await audit().findByOrganizationId(organizationId), []);
});

test('an invitation whose record cannot be written leaves no person and no membership', async () => {
  // The heavier half: `inviteSchoolUser` writes a manager row and a membership,
  // so a partial rollback would leave somebody in the people table who was
  // never invited — and, because a school holds one standing membership, could
  // block the next invitation with a row nobody can explain.
  await assert.rejects(() =>
    runInTransaction(async ({ auditLogRepo, managerRepo, orgRepo }) => {
      const outcome = await ManagerAdministrationService.inviteSchoolUser(
        managerRepo,
        orgRepo,
        { email: 'principal@school.ac.il', organizationId },
      );
      assert.strictEqual(outcome.ok, true);

      await auditLogRepo.recordEvent(
        event({ action: 'MEMBER_INVITED', details: UNSTORABLE_DETAILS }),
      );
    }, prisma),
  );

  assert.deepStrictEqual(
    await managers().findMembershipsByOrganizationId(organizationId),
    [],
  );
  assert.strictEqual(
    await managers().findByEmail('principal@school.ac.il'),
    null,
    'the person row is part of the invitation and rolls back with it',
  );
  assert.deepStrictEqual(await audit().findByOrganizationId(organizationId), []);
});

test('an invitation whose record can be written keeps both', async () => {
  // The negative control. Without it every assertion above would pass on a
  // product that had stopped inviting anybody.
  await runInTransaction(async ({ auditLogRepo, managerRepo, orgRepo }) => {
    const outcome = await ManagerAdministrationService.inviteSchoolUser(
      managerRepo,
      orgRepo,
      { email: 'principal@school.ac.il', organizationId },
    );
    assert.strictEqual(outcome.ok, true);

    await auditLogRepo.recordEvent(event({ action: 'MEMBER_INVITED' }));
  }, prisma);

  const memberships = await managers().findMembershipsByOrganizationId(organizationId);
  assert.strictEqual(memberships.length, 1);
  assert.strictEqual(memberships[0].status, 'invited');

  const events = await audit().findByOrganizationId(organizationId);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].action, 'MEMBER_INVITED');
});
