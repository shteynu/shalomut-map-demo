/**
 * The narrow read of a round's responses, against a real PostgreSQL.
 *
 * `findResponseTimingsByRoundId` exists because the fill-time report reads
 * three scalar columns off each response and used to fetch the responses whole
 * to get them — which joins every `question_answers` row of the round. Three
 * hundred staff on the 126-item instrument is thirty-eight thousand rows
 * fetched to compute a median.
 *
 * Two things only a database can settle. That the narrowed `select` returns the
 * same values the wide read does, down to the null-versus-undefined boundary
 * that `mapToDomain` settles for the wide one and that this read has to settle
 * again for itself. And that a response whose answers exist is still returned —
 * a `select` that named a relation wrongly could quietly filter rather than
 * narrow.
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
let surveyRepo: PrismaSurveyRepository;

let roundId: string;

before(async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');

  pool = new Pool({ connectionString });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  surveyRepo = new PrismaSurveyRepository(prisma);
});

after(async () => {
  await prisma.$disconnect?.();
  await pool.end();
});

beforeEach(async () => {
  await prisma.organization.deleteMany({});

  const organizationId = randomUUID();
  await new PrismaOrganizationRepository(prisma).create({
    id: organizationId,
    name: 'בית ספר לבדיקת זמנים',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });

  roundId = randomUUID();
  await new PrismaRoundRepository(prisma).create({
    id: roundId,
    organizationId,
    title: 'סבב לבדיקת זמנים',
    status: 'active',
    shareCode: `TIMING-${roundId.slice(0, 8)}`,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב לבדיקת זמנים', 10),
    createdAt: new Date(),
  });
});

/** A stored response with answers behind it, so the narrowing has work to do. */
async function seed(
  index: number,
  extra: { anonymousTokenHash?: string; visibleSeconds?: number } = {},
) {
  return surveyRepo.saveResponse({
    id: randomUUID(),
    roundId,
    submittedAt: new Date(`2026-08-20T09:${String(index).padStart(2, '0')}:00Z`),
    answers: [
      { questionId: 'balance-1', dimensionId: 'balance', value: 'green', score: 100 },
      { questionId: 'age-band', value: '31-40' },
    ],
    ...extra,
  });
}

test('the narrow read returns exactly the wide read without its answers', async () => {
  await seed(1, { anonymousTokenHash: 'a'.repeat(64), visibleSeconds: 240 });
  await seed(2, { anonymousTokenHash: 'b'.repeat(64) });

  const wide = await surveyRepo.findResponsesByRoundId(roundId);
  const narrow = await surveyRepo.findResponseTimingsByRoundId(roundId);

  const key = (row: { id: string }) => row.id;
  assert.deepStrictEqual(
    [...narrow].sort((l, r) => key(l).localeCompare(key(r))),
    [...wide]
      .map(({ answers: _answers, ...rest }) => rest)
      .sort((l, r) => key(l).localeCompare(key(r))),
    'the same rows and the same values, minus the join',
  );
});

test('an unmeasured response reads as absent rather than as null', async () => {
  // The boundary `mapToDomain` settles for the wide read, which this one has to
  // settle again for itself: `visibleSeconds` is nullable, and a `null` wearing
  // the domain type is a value — arithmetic reads it as zero, and the fill-time
  // report would count a response as instant rather than as unmeasured.
  await seed(3, { anonymousTokenHash: 'c'.repeat(64) });

  const [timing] = await surveyRepo.findResponseTimingsByRoundId(roundId);

  assert.ok(!('visibleSeconds' in timing));
  assert.strictEqual(timing.visibleSeconds, undefined);
});

test('a response stored without a token keeps its absence too', async () => {
  // The other nullable column this read carries, and the one the report uses to
  // decide a duration cannot be computed at all.
  await seed(4);

  const [timing] = await surveyRepo.findResponseTimingsByRoundId(roundId);

  assert.strictEqual(timing.anonymousTokenHash, undefined);
  assert.strictEqual(timing.roundId, roundId);
});

test('a round with no responses reads as none rather than as all of them', async () => {
  // A `where` dropped from a narrowed query returns every response on the
  // platform, and every assertion above would still pass.
  await seed(5, { anonymousTokenHash: 'e'.repeat(64) });

  assert.deepStrictEqual(
    await surveyRepo.findResponseTimingsByRoundId(randomUUID()),
    [],
  );
});
