/**
 * The widened answer row, against a real PostgreSQL.
 *
 * `question_answers.dimension_id` and `.score` became nullable so a background
 * answer — a demographic choice, an allocation entry — can be stored beside
 * the scored ones. Two things that only the database can settle: that a null
 * actually reaches the column rather than being rejected by a constraint the
 * migration missed, and that a null comes back as `undefined` rather than as
 * `null` leaking into the domain record, which is where a `0` would quietly
 * appear in a dimension average.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a
 * database, and `npm run verify:db` supplies a disposable one and migrates it
 * first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import {
  PrismaOrganizationRepository,
  PrismaRoundRepository,
  PrismaSurveyRepository,
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
/**
 * The same client, untyped. `MinimalPrismaClient` is the narrow surface the
 * repositories are allowed to use; this suite deliberately reaches past it to
 * read the raw rows and the column metadata, which is the whole point of
 * running against a real database.
 */
let raw: any;
let orgRepo: PrismaOrganizationRepository;
let roundRepo: PrismaRoundRepository;
let surveyRepo: PrismaSurveyRepository;

let organizationId: string;
let roundId: string;

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  raw = prisma;
  orgRepo = new PrismaOrganizationRepository(prisma);
  roundRepo = new PrismaRoundRepository(prisma);
  surveyRepo = new PrismaSurveyRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  await prisma.organization.deleteMany({});

  organizationId = randomUUID();
  await orgRepo.create({
    id: organizationId,
    name: 'בית ספר לבדיקת תשובות',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });

  roundId = randomUUID();
  await roundRepo.create({
    id: roundId,
    organizationId,
    title: 'סבב לבדיקת תשובות',
    status: 'active',
    shareCode: `SHAPES-${roundId.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב לבדיקת תשובות', 10),
    createdAt: new Date(),
  });
});

test('the columns the migration widened accept null', async () => {
  const [{ dimension_nullable, score_nullable }] = await raw.$queryRawUnsafe(
    `SELECT
       max(CASE WHEN column_name = 'dimension_id' THEN is_nullable END) AS dimension_nullable,
       max(CASE WHEN column_name = 'score' THEN is_nullable END) AS score_nullable
     FROM information_schema.columns
     WHERE table_name = 'question_answers'`,
  );

  assert.strictEqual(dimension_nullable, 'YES');
  assert.strictEqual(score_nullable, 'YES');
});

test('a background answer is stored with no dimension and no score, and reads back as undefined', async () => {
  const responseId = randomUUID();
  await surveyRepo.saveResponse({
    id: responseId,
    roundId,
    anonymousTokenHash: 'b'.repeat(64),
    submittedAt: new Date(),
    answers: [
      { questionId: 'balance-1', dimensionId: 'balance', value: 'green', score: 100 },
      { questionId: 'age-band', value: '31-40' },
      { questionId: 'time-classroom', value: '45' },
    ],
  });

  const stored: any[] = await raw.questionAnswer.findMany({
    where: { responseId },
    orderBy: { questionId: 'asc' },
  });
  const byQuestion = new Map(stored.map((row) => [row.questionId, row]));

  assert.strictEqual(byQuestion.get('age-band')!.dimensionId, null);
  assert.strictEqual(byQuestion.get('age-band')!.score, null);
  assert.strictEqual(byQuestion.get('age-band')!.value, '31-40');
  assert.strictEqual(byQuestion.get('balance-1')!.score, 100);

  const [read] = await surveyRepo.findResponsesByRoundId(roundId);
  const answer = read.answers.find((a) => a.questionId === 'age-band')!;

  // `undefined`, not `null`. The domain type says the field is absent, and a
  // null crossing into it would be a value that arithmetic treats as zero.
  assert.strictEqual(answer.score, undefined);
  assert.strictEqual(answer.dimensionId, undefined);
});

test('a Likert answer keeps its own step and its normalised score', async () => {
  const responseId = randomUUID();
  await surveyRepo.saveResponse({
    id: responseId,
    roundId,
    anonymousTokenHash: 'c'.repeat(64),
    submittedAt: new Date(),
    // A seven-point step scored as its own complement: a high frequency of
    // exhaustion is a low wellbeing score.
    answers: [{ questionId: 'burnout-1', dimensionId: 'balance', value: '6', score: 17 }],
  });

  const [read] = await surveyRepo.findResponsesByRoundId(roundId);
  assert.strictEqual(read.answers[0].value, '6');
  assert.strictEqual(read.answers[0].score, 17);
});

test('one answer per question still holds when the answer carries no dimension', async () => {
  // The uniqueness key is (response_id, question_id) and does not mention the
  // dimension, so making the dimension nullable must not open a second row.
  const responseId = randomUUID();
  await surveyRepo.saveResponse({
    id: responseId,
    roundId,
    anonymousTokenHash: 'd'.repeat(64),
    submittedAt: new Date(),
    answers: [{ questionId: 'age-band', value: '31-40' }],
  });

  await assert.rejects(
    raw.questionAnswer.create({
      data: { responseId, questionId: 'age-band', value: '41-50' },
    }),
  );
});
