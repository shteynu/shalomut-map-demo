/**
 * The funnel as database behaviour.
 *
 * Three things about it exist only in PostgreSQL and the in-memory repository
 * can only imitate: the unique key that makes a reload one session rather than
 * two, the cascade that takes a round's sessions with the round, and the
 * monotonic upsert — which is repository code, but code that reads a row and
 * then writes it, so it is worth proving where the row is real.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import {
  PrismaOrganizationRepository,
  PrismaRoundRepository,
  PrismaSurveyAttemptRepository,
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
let attemptRepo: PrismaSurveyAttemptRepository;

let organizationId: string;
let roundId: string;

const HASH = 'a'.repeat(64);

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  orgRepo = new PrismaOrganizationRepository(prisma);
  roundRepo = new PrismaRoundRepository(prisma);
  attemptRepo = new PrismaSurveyAttemptRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  // Cascades reach rounds and their attempts. This database is disposable by
  // design and is never the deployed one — `verify:db` refuses a managed host.
  await prisma.organization.deleteMany({});

  organizationId = randomUUID();
  await orgRepo.create({
    id: organizationId,
    name: 'בית ספר לבדיקת היענות',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });

  roundId = randomUUID();
  await roundRepo.create({
    id: roundId,
    organizationId,
    title: 'סבב לבדיקת היענות',
    status: 'active',
    shareCode: `FUNNEL-${roundId.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב לבדיקת היענות', 10),
    createdAt: new Date(),
  });
});

test('a session that reloads five times is one row', async () => {
  for (let i = 0; i < 5; i += 1) {
    await attemptRepo.record({
      roundId,
      anonymousTokenHash: HASH,
      stage: 'opened',
    });
  }

  const attempts = await attemptRepo.findByRoundId(roundId);
  assert.strictEqual(attempts.length, 1);
});

test('two sessions on the same round are two rows', async () => {
  await attemptRepo.record({
    roundId,
    anonymousTokenHash: HASH,
    stage: 'opened',
  });
  await attemptRepo.record({
    roundId,
    anonymousTokenHash: 'b'.repeat(64),
    stage: 'opened',
  });

  assert.strictEqual((await attemptRepo.findByRoundId(roundId)).length, 2);
});

test('out-of-order beacons never walk a session backwards', async () => {
  await attemptRepo.record({
    roundId,
    anonymousTokenHash: HASH,
    stage: 'progress',
    lastQuestionReached: 9,
  });
  // The reload's `opened` and a stale `progress` both arrive late, which is the
  // ordinary case for a client that does not wait for a reply.
  await attemptRepo.record({
    roundId,
    anonymousTokenHash: HASH,
    stage: 'opened',
  });
  await attemptRepo.record({
    roundId,
    anonymousTokenHash: HASH,
    stage: 'progress',
    lastQuestionReached: 2,
  });

  const [attempt] = await attemptRepo.findByRoundId(roundId);
  assert.strictEqual(attempt.lastQuestionReached, 9);
  assert.ok(attempt.consentAcceptedAt, 'progress implies the consent happened');
});

test('completion is written once and does not move afterwards', async () => {
  await attemptRepo.record({
    roundId,
    anonymousTokenHash: HASH,
    stage: 'consented',
  });

  const first = await attemptRepo.markCompleted(roundId, HASH);
  assert.ok(first?.completedAt);

  const again = await attemptRepo.markCompleted(roundId, HASH);
  assert.deepStrictEqual(
    again?.completedAt?.toISOString(),
    first?.completedAt?.toISOString(),
    'a retried submission must not restamp the completion',
  );
});

test('completing a session nobody recorded is not an error', async () => {
  // A response submitted from a session that opened before this table existed.
  assert.strictEqual(await attemptRepo.markCompleted(roundId, HASH), null);
});

test("a round's sessions die with the round", async () => {
  await attemptRepo.record({
    roundId,
    anonymousTokenHash: HASH,
    stage: 'opened',
  });

  await prisma.surveyRound.deleteMany({ where: { id: roundId } });

  assert.deepStrictEqual(await attemptRepo.findByRoundId(roundId), []);
});
