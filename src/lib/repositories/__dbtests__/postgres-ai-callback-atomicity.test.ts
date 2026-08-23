/**
 * The two writes that finish a paid analysis, proved where they can be.
 *
 * The 2026-08-21 audit found the durable run closed and the round's legacy
 * `aiInsights` column written separately: a dropped connection between them
 * leaves a run marked `succeeded` beside a column holding the map it was meant
 * to replace, each half internally valid, nothing downstream able to notice.
 *
 * `src/lib/server/__tests__/one-transaction-finishes-a-paid-run.test.ts` proves
 * the reporting and reproduces the divergence — a `Map` mutated by one process
 * has nothing to roll back. This asks PostgreSQL the question that suite
 * cannot.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { runInTransaction } from '../../composition-root';
import { applyAiInsightsCallback } from '../../server/ai-insights-service';
import {
  PrismaAiAnalysisRunRepository,
  PrismaAiInsightsRepository,
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

let organizationId: string;
let roundId: string;
let runId: string;
let leaseToken: string;

const PREVIOUS_MAP = { contractVersion: '1.0', summary: 'המפה הקודמת' };

function repositories() {
  return {
    aiAnalysisRunRepo: new PrismaAiAnalysisRunRepository(prisma),
    aiInsightsRepo: new PrismaAiInsightsRepository(prisma),
    roundRepo: new PrismaRoundRepository(prisma),
    surveyRepo: new PrismaSurveyRepository(prisma),
  };
}

/** Contract 1.0: no definition hash and no round verification on the way in. */
function result() {
  return {
    contractVersion: '1.0',
    roundId,
    isLocked: true,
    status: 'locked_error',
    errorMessage: 'Privacy lock active',
  };
}

/** What each store says about this analysis, read together. */
async function stored() {
  const repos = repositories();
  const run = await repos.aiAnalysisRunRepo.findById(runId);
  const insights = await repos.aiInsightsRepo.findByRoundId(roundId);
  return { runState: run?.state, summary: insights?.summary ?? null };
}

/**
 * The store set the transaction hands the callback, with the column write
 * refused — the failure the audit describes, injected at the one place that
 * cannot be provoked on demand.
 */
function refusingTheColumn(repositories: {
  aiAnalysisRunRepo: unknown;
  aiInsightsRepo: unknown;
}) {
  return {
    ...repositories,
    aiInsightsRepo: {
      ...(repositories.aiInsightsRepo as object),
      save: async () => false,
    },
  } as never;
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
    name: 'בית ספר לבדיקת קולבק',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });

  const repos = repositories();

  await repos.roundRepo.create({
    id: roundId,
    organizationId,
    title: 'סבב לבדיקת קולבק',
    status: 'closed',
    shareCode: `CALLBACK-${roundId.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב לבדיקת קולבק', 10),
    createdAt: new Date(),
  });

  // The previous map, so a rollback that left the column half-written would
  // show up as something other than this exact object.
  await repos.aiInsightsRepo.save(roundId, PREVIOUS_MAP);

  await repos.aiAnalysisRunRepo.enqueue(roundId, {
    requestKey: `manual:${randomUUID()}`,
    trigger: 'manual',
  });
  const claimed = await repos.aiAnalysisRunRepo.claimNext({
    workerId: 'worker-under-test',
    leaseMs: 600_000,
  });
  assert.ok(claimed, 'the run must be leased before a callback can finish it');
  runId = claimed.run.id;
  leaseToken = claimed.leaseToken;
});

test('the round starts with a leased run and the previous map', async () => {
  // The negative control for the setup. Without it a rollback test passes just
  // as happily on a round that had nothing to lose.
  assert.deepStrictEqual(await stored(), {
    runState: 'running',
    summary: PREVIOUS_MAP.summary,
  });
});

test('a column write that fails takes the run transition down with it', async () => {
  const outcome = await applyAiInsightsCallback(
    roundId,
    { runId, leaseToken },
    result(),
    repositories(),
    (work) =>
      runInTransaction(
        (transactional) => work(refusingTheColumn(transactional)),
        prisma,
      ),
  );

  assert.strictEqual(outcome.outcome, 'write_failed');
  // Both halves as they were: the run is still leased and still `running`, so
  // the worker's retry can finish it, and the round still holds the map it had.
  assert.deepStrictEqual(await stored(), {
    runState: 'running',
    summary: PREVIOUS_MAP.summary,
  });
});

test('the same failure without a transaction leaves the two stores disagreeing', async () => {
  // The negative control that makes the test above mean something. Same
  // callback, same injected failure, a runner that simply calls the work — and
  // the run says `succeeded` about a map the round never received.
  const outcome = await applyAiInsightsCallback(
    roundId,
    { runId, leaseToken },
    result(),
    repositories(),
    (work) => work(refusingTheColumn(repositories())),
  );

  assert.strictEqual(outcome.outcome, 'write_failed');
  assert.deepStrictEqual(await stored(), {
    runState: 'succeeded',
    summary: PREVIOUS_MAP.summary,
  });
});

test('a callback that succeeds commits both halves', async () => {
  // Without this the two above would pass on a callback that had stopped
  // writing anything at all.
  const outcome = await applyAiInsightsCallback(
    roundId,
    { runId, leaseToken },
    result(),
    repositories(),
    (work) => runInTransaction((transactional) => work(transactional), prisma),
  );

  assert.strictEqual(outcome.outcome, 'persisted');
  const after = await stored();
  assert.strictEqual(after.runState, 'succeeded');
  assert.notStrictEqual(
    after.summary,
    PREVIOUS_MAP.summary,
    'the column must hold the new result, not the map it replaced',
  );
});

test('the retry after a rolled-back failure finishes the run', async () => {
  // What the whole change is for. The worker reads a 500 as transient and posts
  // again; the run is still `running` with the same lease, so the second
  // callback transitions it and the paid analysis survives.
  await applyAiInsightsCallback(
    roundId,
    { runId, leaseToken },
    result(),
    repositories(),
    (work) =>
      runInTransaction(
        (transactional) => work(refusingTheColumn(transactional)),
        prisma,
      ),
  );

  const retry = await applyAiInsightsCallback(
    roundId,
    { runId, leaseToken },
    result(),
    repositories(),
    (work) => runInTransaction((transactional) => work(transactional), prisma),
  );

  assert.strictEqual(retry.outcome, 'persisted');
  assert.strictEqual((await stored()).runState, 'succeeded');
});
