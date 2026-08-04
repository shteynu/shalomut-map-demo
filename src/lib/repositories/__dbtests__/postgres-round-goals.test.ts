/**
 * The goal table's constraints as database behaviour.
 *
 * The service tests prove the repository refuses a duplicate it can see; they
 * cannot prove anything refuses two writes that race, because the in-memory
 * store is single-threaded. The unique key and the cascade from the round exist
 * only in PostgreSQL, so they are only provable here.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import {
  PrismaOrganizationRepository,
  PrismaRoundGoalRepository,
  PrismaRoundRepository,
} from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import type { CreateRoundGoalInput } from '../../types/round-goal';

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
let goalRepo: PrismaRoundGoalRepository;

let organizationId: string;
let roundId: string;

const RECOMMENDATION: CreateRoundGoalInput = {
  dimensionId: 'balance',
  title: 'יום ללא ישיבות',
  body: 'לקבוע יום קבוע בשבוע ללא ישיבות צוות.',
};

async function createRound(): Promise<string> {
  const id = randomUUID();

  await roundRepo.create({
    id,
    organizationId,
    title: 'סבב לבדיקת יעדים',
    status: 'closed',
    shareCode: `GOAL-${id.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב לבדיקת יעדים', 10),
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
  goalRepo = new PrismaRoundGoalRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  // Cascades reach rounds and their goals. This database is disposable by
  // design and is never the deployed one — `verify:db` refuses a managed host.
  await prisma.organization.deleteMany({});

  organizationId = randomUUID();
  await orgRepo.create({
    id: organizationId,
    name: 'בית ספר לבדיקת יעדים',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });
  roundId = await createRound();
});

test('two simultaneous attempts at one recommendation leave one goal', async () => {
  // A double-tapped button. Both requests pass the service check, so only the
  // unique index can settle it — and the loser is answered with the row that
  // won rather than an error the manager has to interpret.
  const [first, second] = await Promise.all([
    goalRepo.create(roundId, RECOMMENDATION),
    goalRepo.create(roundId, RECOMMENDATION),
  ]);

  const outcomes = [first.outcome, second.outcome].sort();
  assert.deepStrictEqual(outcomes, ['created', 'duplicate']);
  assert.strictEqual(first.goal.id, second.goal.id);
  assert.strictEqual((await goalRepo.findByRoundId(roundId)).length, 1);
});

test('the same recommendation may be tracked by a second round of the same school', async () => {
  await goalRepo.create(roundId, RECOMMENDATION);

  const nextRoundId = await createRound();
  const created = await goalRepo.create(nextRoundId, RECOMMENDATION);

  assert.strictEqual(created.outcome, 'created');
});

test('one dimension may hold several goals', async () => {
  await goalRepo.create(roundId, RECOMMENDATION);
  const second = await goalRepo.create(roundId, {
    ...RECOMMENDATION,
    title: 'שעת צוות קבועה',
  });

  assert.strictEqual(second.outcome, 'created');
  assert.strictEqual((await goalRepo.findByRoundId(roundId)).length, 2);
});

test('a goal id from another round changes and deletes nothing', async () => {
  const { goal } = await goalRepo.create(roundId, RECOMMENDATION);
  const otherRoundId = await createRound();

  assert.strictEqual(
    await goalRepo.updateStatus(otherRoundId, goal.id, 'done'),
    null,
  );
  assert.strictEqual(await goalRepo.delete(otherRoundId, goal.id), false);
  assert.strictEqual((await goalRepo.findByRoundId(roundId))[0].status, 'selected');
});

test('a status change is persisted and stamped', async () => {
  const { goal } = await goalRepo.create(roundId, RECOMMENDATION);

  const updated = await goalRepo.updateStatus(roundId, goal.id, 'in_progress');

  assert.strictEqual(updated?.status, 'in_progress');
  assert.ok(
    updated!.updatedAt.getTime() >= goal.createdAt.getTime(),
    'the row records when it last changed',
  );
  assert.strictEqual(
    (await goalRepo.findByRoundId(roundId))[0].status,
    'in_progress',
  );
});

test('deleting the round takes its goals with it', async () => {
  await goalRepo.create(roundId, RECOMMENDATION);

  await prisma.surveyRound.deleteMany({ where: { id: roundId } });

  assert.deepStrictEqual(await goalRepo.findByRoundId(roundId), []);
});
