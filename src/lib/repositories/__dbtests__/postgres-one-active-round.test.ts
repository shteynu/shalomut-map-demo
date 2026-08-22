/**
 * The single-active-round rule as database behaviour.
 *
 * The service tests prove `RoundService` closes the previous round; they cannot
 * prove anything refuses a second active round, because the in-memory
 * repository has no constraints. Only these run against a real PostgreSQL, and
 * only here does the partial unique index actually exist.
 *
 * Outside `__tests__` on purpose, like the concurrency suite: `npm test` stays
 * runnable without a database, and `npm run verify:db` supplies a disposable
 * one and applies the migrations first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { PrismaOrganizationRepository, PrismaRoundRepository } from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import { RoundService } from '../../services/round.service';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import { RoundStatus, SurveyRound } from '../../types/backend';

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
let roundRepo: PrismaRoundRepository;

let organizationId: string;

function roundRecord(
  status: RoundStatus,
  overrides: Partial<SurveyRound> = {},
): SurveyRound {
  const id = overrides.id ?? randomUUID();

  return {
    id,
    organizationId,
    title: `סבב ${status}`,
    status,
    shareCode: `TEST-${id.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב בדיקה', 10),
    createdAt: new Date(),
    ...overrides,
  };
}

async function createOrganization(): Promise<string> {
  const id = randomUUID();

  await orgRepo.create({
    id,
    name: 'בית ספר לבדיקת סבב פעיל',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });

  return id;
}

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  orgRepo = new PrismaOrganizationRepository(prisma);
  roundRepo = new PrismaRoundRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  // Cascades reach rounds, responses and answers. This database is disposable
  // by design and is never the deployed one — `verify:db` refuses a managed
  // host.
  await prisma.organization.deleteMany({});
  organizationId = await createOrganization();
});

test('the database refuses a second active round for one school', async () => {
  await roundRepo.create(roundRecord('active'));

  await assert.rejects(
    () => roundRepo.create(roundRecord('active')),
    (error: unknown) => {
      assert.strictEqual((error as { code?: string }).code, 'P2002');
      return true;
    },
    'the partial unique index must refuse the second active round',
  );
});

test('a school may hold any number of draft, closed and archived rounds', async () => {
  // Only 'active' is constrained: the history a second round extends is made of
  // exactly these rows.
  await roundRepo.create(roundRecord('draft'));
  await roundRepo.create(roundRecord('draft'));
  await roundRepo.create(roundRecord('closed'));
  await roundRepo.create(roundRecord('closed'));
  await roundRepo.create(roundRecord('archived'));

  const stored = await roundRepo.findByOrganizationId(organizationId);
  assert.strictEqual(stored.length, 5);
});

test('two schools each keep their own active round', async () => {
  await roundRepo.create(roundRecord('active'));

  const otherOrganizationId = await createOrganization();
  const theirs = roundRecord('active', { organizationId: otherOrganizationId });
  const created = await roundRepo.create(theirs);

  assert.strictEqual(created.status, 'active');
});

test('activating a round through the service satisfies the index', async () => {
  // This is the ordinary path, and the one that would fail if the service still
  // flipped the new round to active before closing the previous one.
  const running = await roundRepo.create(roundRecord('active'));
  const next = await roundRepo.create(roundRecord('draft'));

  const activation = await RoundService.activateRound(next.id, roundRepo);

  assert.strictEqual(activation.ok, true);
  assert.strictEqual(
    activation.ok ? activation.round.status : null,
    'active',
  );
  assert.deepStrictEqual(
    activation.closedRounds.map((entry) => entry.id),
    [running.id],
  );
  assert.strictEqual((await roundRepo.findById(running.id))?.status, 'closed');
});

test('creating a live round through the service satisfies the index', async () => {
  const running = await roundRepo.create(roundRecord('active'));

  const created = await RoundService.createAndSaveRound(
    {
      organizationId,
      title: 'סבב שנולד פעיל',
      surveyDefinition: createCanonicalSurveyDefinition('סבב שנולד פעיל', 10),
    },
    roundRepo,
  );

  assert.strictEqual(created.status, 'active');
  assert.strictEqual((await roundRepo.findById(running.id))?.status, 'closed');

  const active = (await roundRepo.findByOrganizationId(organizationId)).filter(
    (entry) => entry.status === 'active',
  );
  assert.deepStrictEqual(active.map((entry) => entry.id), [created.id]);
});

test('a status write applies only from the status it expected', async () => {
  // The conditional write, against the database that has to honour it. A unit
  // test can only ask a mock whether it passed the clause along; whether
  // PostgreSQL matches no row when the status has moved is decided here.
  const created = await roundRepo.create(roundRecord('draft'));
  await roundRepo.updateStatus(created.id, 'archived', 'draft');

  const stale = await roundRepo.updateStatus(created.id, 'active', 'draft');

  assert.strictEqual(stale.outcome, 'status_changed');
  assert.strictEqual(
    stale.outcome === 'status_changed' ? stale.current : null,
    'archived',
  );
  assert.strictEqual(
    (await roundRepo.findById(created.id))?.status,
    'archived',
  );
});

test('the index refusal arrives as the round the school is running', async () => {
  // The one outcome no unit test can establish. The `P2002` shape depends on
  // how the client reached the database, and this suite uses the adapter-backed
  // runtime — so if the constraint name ever stops arriving where the
  // repository reads it, this is what notices, and the manager stops being told
  // a real refusal is an unknown write failure.
  const running = await roundRepo.create(roundRecord('active'));
  const waiting = await roundRepo.create(roundRecord('draft'));

  const write = await roundRepo.updateStatus(waiting.id, 'active', 'draft');

  assert.strictEqual(write.outcome, 'another_round_is_active');
  assert.strictEqual(
    write.outcome === 'another_round_is_active' ? write.activeRound?.id : null,
    running.id,
  );
  assert.strictEqual((await roundRepo.findById(waiting.id))?.status, 'draft');
});

/**
 * `updated_at` is Prisma's `@updatedAt`, which the in-memory repository can
 * only imitate. Whether PostgreSQL actually receives a new value on every write
 * is decided here, and the manager screens read it as their save time.
 */
test('every write stamps when the round reached the database', async () => {
  const created = await roundRepo.create(roundRecord('draft'));
  assert.ok(created.updatedAt instanceof Date);

  const edited = await roundRepo.update(created.id, { title: 'סבב אחרי עריכה' });
  assert.ok(edited?.updatedAt instanceof Date);
  assert.ok(edited.updatedAt.getTime() >= created.updatedAt!.getTime());

  // Activation is a write of its own, so it moves the time the builder shows.
  const write = await roundRepo.updateStatus(created.id, 'active', 'draft');
  assert.strictEqual(write.outcome, 'written');
  const activated = write.outcome === 'written' ? write.round : null;
  assert.ok(activated?.updatedAt instanceof Date);
  assert.ok(activated.updatedAt.getTime() >= edited.updatedAt.getTime());

  // And a fresh read returns the stored value rather than the write's own copy.
  const reloaded = await roundRepo.findById(created.id);
  assert.strictEqual(
    reloaded?.updatedAt?.getTime(),
    activated.updatedAt.getTime(),
  );
});
