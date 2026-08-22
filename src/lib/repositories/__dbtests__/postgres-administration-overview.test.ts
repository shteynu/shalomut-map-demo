/**
 * The three set-based reads behind the administrator overview, against a real
 * PostgreSQL.
 *
 * The in-memory repositories prove the screen still says the same things and
 * that it asks a fixed number of questions. What they cannot prove is that
 * these particular queries are the ones PostgreSQL answers as intended: that
 * `IN` is scoped to the ids given, that a `select` really leaves the round's
 * questionnaire in the table, and that a `GROUP BY` count comes back in the
 * shape the repository reads — including that a round nobody answered is
 * absent from it rather than present as zero.
 *
 * Outside `__tests__` like the rest of the PostgreSQL suite: `npm test` stays
 * runnable without a database, and `npm run verify:db` supplies a disposable
 * one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import {
  PrismaManagerRepository,
  PrismaOrganizationRepository,
  PrismaRoundRepository,
  PrismaSurveyRepository,
} from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import { RoundStatus } from '../../types/backend';

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
let roundRepo: PrismaRoundRepository;
let surveyRepo: PrismaSurveyRepository;

async function createSchool(name: string): Promise<string> {
  const id = randomUUID();
  await orgRepo.create({
    id,
    name,
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });
  return id;
}

async function createRound(
  organizationId: string,
  status: RoundStatus,
): Promise<string> {
  const id = randomUUID();
  await roundRepo.create({
    id,
    organizationId,
    title: `סבב ${status}`,
    status,
    shareCode: `OVW-${id.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    // The column this read exists to avoid.
    surveyDefinition: createCanonicalSurveyDefinition('סבב סקירה', 10),
    createdAt: new Date(),
  });
  return id;
}

async function answer(roundId: string, index: number): Promise<void> {
  await surveyRepo.saveResponse({
    id: randomUUID(),
    roundId,
    anonymousTokenHash: `${index}`.padStart(64, 'c'),
    submittedAt: new Date(),
    answers: [
      { questionId: 'balance-1', dimensionId: 'balance', value: 'green', score: 100 },
    ],
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
  roundRepo = new PrismaRoundRepository(prisma);
  surveyRepo = new PrismaSurveyRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  await prisma.organization.deleteMany({});
  await prisma.manager?.deleteMany({});
});

test('round summaries come back for the named schools and nobody else', async () => {
  const north = await createSchool('בית ספר צפון');
  const south = await createSchool('בית ספר דרום');
  const closed = await createRound(north, 'closed');
  const active = await createRound(north, 'active');
  await createRound(south, 'active');

  const summaries = await roundRepo.findSummariesByOrganizationIds([north]);

  assert.deepStrictEqual(
    summaries.map((summary) => summary.id).sort(),
    [closed, active].sort(),
  );
  assert.strictEqual(summaries[0].organizationId, north);
  assert.ok(summaries[0].createdAt instanceof Date);
  // The questionnaire is in the table and not in the answer: reading it per
  // round is what made this screen pull megabytes to show six fields.
  assert.strictEqual('surveyDefinition' in summaries[0], false);
  assert.ok((await roundRepo.findById(closed))?.surveyDefinition);
});

test('an empty list of schools comes back empty, never as everything', async () => {
  assert.deepStrictEqual(await roundRepo.findSummariesByOrganizationIds([]), []);
  assert.deepStrictEqual(
    await managerRepo.findMembershipsByOrganizationIds([]),
    [],
  );
  assert.deepStrictEqual(
    Array.from((await surveyRepo.countResponsesByRoundIds([])).entries()),
    [],
  );
});

test('one grouped query counts every named round, and omits the unanswered', async () => {
  const school = await createSchool('בית ספר ספירה');
  const answered = await createRound(school, 'active');
  const untouched = await createRound(school, 'closed');
  await answer(answered, 1);
  await answer(answered, 2);
  await answer(answered, 3);

  const counts = await surveyRepo.countResponsesByRoundIds([
    answered,
    untouched,
  ]);

  assert.strictEqual(counts.get(answered), 3);
  // Absent rather than zero, which is what a `GROUP BY` says about a round with
  // no rows — the caller reads it as `?? 0`.
  assert.strictEqual(counts.has(untouched), false);
  assert.strictEqual(counts.size, 1);
});

test('the grouped count agrees with counting one round at a time', async () => {
  const school = await createSchool('בית ספר השוואה');
  const first = await createRound(school, 'active');
  const second = await createRound(school, 'closed');
  await answer(first, 1);
  await answer(second, 2);
  await answer(second, 3);

  const grouped = await surveyRepo.countResponsesByRoundIds([first, second]);

  assert.strictEqual(grouped.get(first), await surveyRepo.getResponseCount(first));
  assert.strictEqual(
    grouped.get(second),
    await surveyRepo.getResponseCount(second),
  );
});
