/**
 * The reset's erasure as one write, proved where it can be.
 *
 * The 2026-08-21 audit found five deletes across five tables with nothing
 * holding them together: a crash in the middle left a round whose saved
 * analysis described responses that no longer existed, and each half was
 * internally valid so nothing downstream could notice. The in-memory suite can
 * prove the ordering and the sweep, and it cannot prove this — a `Map` mutated
 * by one process has nothing to roll back.
 *
 * So this asks PostgreSQL. `runInTransaction` is called with a real client, the
 * work throws after erasing everything, and the question is whether the rows
 * are still there.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { runInTransaction } from '../../composition-root';
import { RoundResetService } from '../../services/round-reset.service';
import {
  PrismaAiAnalysisRunRepository,
  PrismaAiInsightsRepository,
  PrismaOrganizationRepository,
  PrismaRoundGoalRepository,
  PrismaRoundRepository,
  PrismaSurveyAttemptRepository,
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

let organizationId: string;
let roundId: string;

/** The store set the reset erases from, over the pool rather than a transaction. */
function stores() {
  return {
    aiAnalysisRunRepo: new PrismaAiAnalysisRunRepository(prisma),
    aiInsightsRepo: new PrismaAiInsightsRepository(prisma),
    roundGoalRepo: new PrismaRoundGoalRepository(prisma),
    roundRepo: new PrismaRoundRepository(prisma),
    surveyAttemptRepo: new PrismaSurveyAttemptRepository(prisma),
    surveyRepo: new PrismaSurveyRepository(prisma),
  };
}

/** What the round holds, counted across all five tables at once. */
async function collected() {
  const repos = stores();
  return {
    responses: await repos.surveyRepo.getResponseCount(roundId),
    attempts: (await repos.surveyAttemptRepo.findByRoundId(roundId)).length,
    insights: (await repos.aiInsightsRepo.findByRoundId(roundId)) ? 1 : 0,
    runs: (await repos.aiAnalysisRunRepo.findByRoundId(roundId)).length,
    goals: (await repos.roundGoalRepo.findByRoundId(roundId)).length,
  };
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
  // Cascades reach the round and everything hanging off it. This database is
  // disposable by design and is never the deployed one — `verify:db` refuses a
  // managed host.
  await prisma.organization.deleteMany({});

  organizationId = randomUUID();
  roundId = randomUUID();

  await new PrismaOrganizationRepository(prisma).create({
    id: organizationId,
    name: 'בית ספר לבדיקת איפוס',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });

  const repos = stores();

  await repos.roundRepo.create({
    id: roundId,
    organizationId,
    title: 'סבב לבדיקת איפוס',
    status: 'active',
    shareCode: `RESET-${roundId.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב לבדיקת איפוס', 10),
    createdAt: new Date(),
  });

  // One row in each of the five tables the erasure touches, so a rollback that
  // saved four of them would still fail this.
  await repos.surveyRepo.saveResponse({
    id: randomUUID(),
    roundId,
    answers: [],
    submittedAt: new Date(),
    anonymousTokenHash: 'token-hash-for-the-reset-test',
  });
  await repos.surveyAttemptRepo.record({
    roundId,
    anonymousTokenHash: 'token-hash-for-the-reset-test',
    stage: 'opened',
  });
  await repos.aiInsightsRepo.save(roundId, { summary: 'ניתוח ישן' });
  await repos.aiAnalysisRunRepo.enqueue(roundId, {
    requestKey: 'automatic:1',
    trigger: 'automatic',
  });
  await repos.roundGoalRepo.create(roundId, {
    dimensionId: 'balance',
    title: 'יום ללא ישיבות',
    body: 'לקבוע יום קבוע בשבוע ללא ישיבות צוות.',
  });
});

test('the round starts with something in every table the reset erases', async () => {
  // The negative control. Without it a rollback test passes just as happily on
  // a round that had nothing to lose.
  assert.deepStrictEqual(await collected(), {
    responses: 1,
    attempts: 1,
    insights: 1,
    runs: 1,
    goals: 1,
  });
});

test('an erasure that fails halfway leaves every table as it was', async () => {
  await assert.rejects(
    () =>
      runInTransaction(async (repositories) => {
        await RoundResetService.eraseCollectedData(repositories, roundId);
        // The crash the audit described, after the five deletes and before the
        // commit.
        throw new Error('the connection dropped');
      }, prisma),
    /the connection dropped/,
  );

  assert.deepStrictEqual(await collected(), {
    responses: 1,
    attempts: 1,
    insights: 1,
    runs: 1,
    goals: 1,
  });
});

test('without the transaction the same failure leaves the round half-erased', async () => {
  // The negative control for the test above, and the only thing that proves it
  // has teeth. The same work, the same crash, against a client that offers no
  // `$transaction` — which is exactly what the route did before 2026-08-23.
  const withoutTransactions = new Proxy(prisma, {
    get: (target, property) =>
      property === '$transaction'
        ? undefined
        : (target as unknown as Record<string | symbol, unknown>)[property],
  }) as MinimalPrismaClient;

  await assert.rejects(
    () =>
      runInTransaction(async (repositories) => {
        await RoundResetService.eraseCollectedData(repositories, roundId);
        throw new Error('the connection dropped');
      }, withoutTransactions),
    /the connection dropped/,
  );

  // Everything gone, and the crash reported as a failure. This is the state the
  // audit described: a round whose saved analysis and whose responses disagree,
  // with each half internally valid.
  assert.deepStrictEqual(await collected(), {
    responses: 0,
    attempts: 0,
    insights: 0,
    runs: 0,
    goals: 0,
  });
});

test('an erasure that finishes takes all five tables with it', async () => {
  const erasure = await runInTransaction(
    (repositories) => RoundResetService.eraseCollectedData(repositories, roundId),
    prisma,
  );

  assert.strictEqual(erasure.deletedResponseCount, 1);
  assert.strictEqual(erasure.deletedGoalCount, 1);
  assert.deepStrictEqual(await collected(), {
    responses: 0,
    attempts: 0,
    insights: 0,
    runs: 0,
    goals: 0,
  });

  // The round itself survives its own reset. That is the whole difference
  // between a reset and a deletion.
  assert.ok(await stores().roundRepo.findById(roundId));
});

test('the erasure is idempotent, which is what makes the sweep safe', async () => {
  await runInTransaction(
    (repositories) => RoundResetService.eraseCollectedData(repositories, roundId),
    prisma,
  );

  const second = await runInTransaction(
    (repositories) => RoundResetService.eraseCollectedData(repositories, roundId),
    prisma,
  );

  assert.strictEqual(second.deletedResponseCount, 0);
  assert.strictEqual(second.deletedGoalCount, 0);
});
