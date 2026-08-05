/**
 * The version table as database behaviour.
 *
 * Two things about the questionnaire history exist only in PostgreSQL and the
 * in-memory repository can only imitate them: the cascade that removes a
 * round's versions with the round, and the ordering the prune depends on when
 * several saves share a millisecond. The retention cap is repository code, but
 * it is worth proving against a real table because it deletes rows.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import {
  DEFINITION_VERSION_RETENTION,
  PrismaOrganizationRepository,
  PrismaRoundRepository,
  PrismaSurveyDefinitionVersionRepository,
} from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import { createCanonicalSurveyDefinition } from '../../survey-definition';

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
let versionRepo: PrismaSurveyDefinitionVersionRepository;

let organizationId: string;
let roundId: string;

async function createRound(): Promise<string> {
  const id = randomUUID();

  await roundRepo.create({
    id,
    organizationId,
    title: 'סבב לבדיקת גרסאות',
    status: 'draft',
    shareCode: `VER-${id.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב לבדיקת גרסאות', 10),
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
  versionRepo = new PrismaSurveyDefinitionVersionRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  // Cascades reach rounds and their versions. This database is disposable by
  // design and is never the deployed one — `verify:db` refuses a managed host.
  await prisma.organization.deleteMany({});

  organizationId = randomUUID();
  await orgRepo.create({
    id: organizationId,
    name: 'בית ספר לבדיקת גרסאות',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });
  roundId = await createRound();
});

test('a version is stored whole and read back as the same questionnaire', async () => {
  const definition = createCanonicalSurveyDefinition('שאלון מקורי', 10);

  const recorded = await versionRepo.record(roundId, definition);
  const read = await versionRepo.findById(roundId, recorded.id);

  assert.ok(read);
  assert.strictEqual(read.definition.title, 'שאלון מקורי');
  assert.strictEqual(read.definition.questions.length, definition.questions.length);
  assert.deepStrictEqual(read.definition, definition);
});

test('the newest versions are kept and the oldest are pruned', async () => {
  const overflow = 2;
  const start = Date.parse('2026-01-01T08:00:00.000Z');

  for (let index = 0; index < DEFINITION_VERSION_RETENTION + overflow; index += 1) {
    await versionRepo.record(
      roundId,
      createCanonicalSurveyDefinition(`גרסה ${index}`, 10),
      // A minute apart, so "oldest" is unambiguous and the assertion below is
      // about the retention rule rather than about write order.
      new Date(start + index * 60_000),
    );
  }

  const versions = await versionRepo.findByRoundId(roundId);
  assert.strictEqual(versions.length, DEFINITION_VERSION_RETENTION);
  assert.strictEqual(
    versions[0].definition.title,
    `גרסה ${DEFINITION_VERSION_RETENTION + overflow - 1}`,
  );
  assert.strictEqual(versions.at(-1)?.definition.title, `גרסה ${overflow}`);
});

test('saves that share a millisecond keep every row the cap allows', async () => {
  // The prune deletes by id, not by a timestamp cutoff. Were it a cutoff, one
  // of these identical stamps would take the row next to it with it.
  const savedAt = new Date('2026-02-02T09:00:00.000Z');

  for (let index = 0; index < DEFINITION_VERSION_RETENTION; index += 1) {
    await versionRepo.record(
      roundId,
      createCanonicalSurveyDefinition(`בו זמנית ${index}`, 10),
      savedAt,
    );
  }

  const versions = await versionRepo.findByRoundId(roundId);
  assert.strictEqual(versions.length, DEFINITION_VERSION_RETENTION);
  assert.strictEqual(new Set(versions.map((version) => version.id)).size, versions.length);
});

test('a version id from another round reads as missing', async () => {
  const recorded = await versionRepo.record(
    roundId,
    createCanonicalSurveyDefinition('שאלון של סבב אחר', 10),
  );
  const otherRoundId = await createRound();

  assert.strictEqual(await versionRepo.findById(otherRoundId, recorded.id), null);
  assert.deepStrictEqual(await versionRepo.findByRoundId(otherRoundId), []);
});

test('deleting the round takes its versions with it', async () => {
  await versionRepo.record(roundId, createCanonicalSurveyDefinition('שאלון', 10));
  const survivorRoundId = await createRound();
  await versionRepo.record(
    survivorRoundId,
    createCanonicalSurveyDefinition('שאלון ששורד', 10),
  );

  await prisma.surveyRound.deleteMany({ where: { id: roundId } });

  assert.deepStrictEqual(await versionRepo.findByRoundId(roundId), []);
  assert.strictEqual((await versionRepo.findByRoundId(survivorRoundId)).length, 1);
});
