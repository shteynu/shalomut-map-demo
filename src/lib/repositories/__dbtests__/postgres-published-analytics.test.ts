/**
 * The round's published numbers as an actual column.
 *
 * The in-memory repository keeps the same encoded blob and proves the codec;
 * it cannot prove that PostgreSQL stores and returns it, that a `Date` written
 * as an ISO string survives `jsonb`, or that clearing writes `NULL` rather than
 * the string "null". This is a read on the way to every manager screen, so
 * those are worth knowing rather than assuming.
 *
 * Outside `__tests__` like the rest of the PostgreSQL suite: `npm test` stays
 * runnable without a database, and `npm run verify:db` supplies a disposable
 * one and applies the migrations first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { PrismaOrganizationRepository, PrismaRoundRepository } from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';
import { AnalyticsService } from '../../services/analytics.service';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import { SurveyRound } from '../../types/backend';

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

function closedRound(): SurveyRound {
  const id = randomUUID();

  return {
    id,
    organizationId,
    title: 'סבב שפורסם',
    status: 'closed',
    shareCode: `PUB-${id.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    surveyDefinition: createCanonicalSurveyDefinition('סבב שפורסם', 10),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  };
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
  await prisma.organization.deleteMany({});
  organizationId = randomUUID();
  await orgRepo.create({
    id: organizationId,
    name: 'בית ספר לבדיקת פרסום',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });
});

test('a round with no published numbers has none, not an empty object', async () => {
  const round = await roundRepo.create(closedRound());

  assert.strictEqual(await roundRepo.findPublishedAnalytics(round.id), null);
});

test('what was published comes back out of the column unchanged', async () => {
  const round = await roundRepo.create(closedRound());
  const published = AnalyticsService.lockedRoundAnalytics(round, 7);

  await roundRepo.savePublishedAnalytics(round.id, published);
  const readBack = await roundRepo.findPublishedAnalytics(round.id);

  assert.ok(readBack, 'the column must return what was written to it');
  // The school context is deliberately not stored — it belongs to the round,
  // stays editable after the round closed, and is read from there. Everything
  // the calculation produced is here.
  const { backgroundContext: _notStored, ...numbers } = published;
  assert.deepStrictEqual(readBack, numbers);
  assert.ok(readBack.calculatedAt instanceof Date);
  assert.strictEqual(
    readBack.calculatedAt.toISOString(),
    published.calculatedAt.toISOString(),
  );
});

test('clearing leaves the round without numbers rather than with empty ones', async () => {
  const round = await roundRepo.create(closedRound());
  await roundRepo.savePublishedAnalytics(
    round.id,
    AnalyticsService.lockedRoundAnalytics(round, 7),
  );

  await roundRepo.clearPublishedAnalytics(round.id);

  assert.strictEqual(await roundRepo.findPublishedAnalytics(round.id), null);
  // A reset that wrote the JSON string "null" would read back as a blob the
  // decoder refuses, which is the same answer for the wrong reason.
  const raw = await prisma.surveyRound.findUnique({
    where: { id: round.id },
    select: { publishedAnalytics: true },
  });
  assert.strictEqual(raw?.publishedAnalytics, null);
});

test('a round that no longer exists is written to without failing a read', async () => {
  // `savePublishedAnalytics` is called on the way out of a read. A round
  // deleted in between must not turn that read into an error.
  const round = closedRound();
  await roundRepo.savePublishedAnalytics(
    round.id,
    AnalyticsService.lockedRoundAnalytics(round, 7),
  );

  assert.strictEqual(await roundRepo.findPublishedAnalytics(round.id), null);
});
