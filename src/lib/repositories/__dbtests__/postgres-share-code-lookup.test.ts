/**
 * The share code is a value, not a pattern.
 *
 * `findByShareCode` asked PostgreSQL for `equals` with `mode: 'insensitive'`,
 * which Prisma compiles to `ILIKE` — and `ILIKE` reads `%` and `_` in the value
 * as wildcards. The product's only unauthenticated lookup therefore answered
 * `GET /api/survey/%` with a school's round, to someone holding no code at all.
 * Confirmed over HTTP against a running server on 2026-08-23 before the change.
 *
 * Nothing in the in-memory suite could have caught it: that repository has
 * always normalized and compared for equality, so the two stores disagreed and
 * only the one nobody tests against was wrong. Which is the argument for
 * asking PostgreSQL directly, here.
 *
 * The 2026-08-21 audit recorded this line as a lookup that could not use its
 * unique index. It could not, and that is fixed by the same change — but it was
 * the smaller half.
 *
 * Outside `__tests__` on purpose: `npm test` stays runnable without a database,
 * and `npm run verify:db` supplies a disposable one and migrates it first.
 */
import assert from 'node:assert';
import test, { after, before, beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { PrismaOrganizationRepository, PrismaRoundRepository } from '..';
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

/** Ten characters after the prefix, the shape `generateShareCode` produces. */
const SHARE_CODE = 'SHALOM-ABCDEFGHJK';

function rounds() {
  return new PrismaRoundRepository(prisma);
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
  // Cascades reach the rounds. This database is disposable by design and is
  // never the deployed one — `verify:db` refuses a managed host.
  await prisma.organization.deleteMany({});

  organizationId = randomUUID();

  await new PrismaOrganizationRepository(prisma).create({
    id: organizationId,
    name: 'בית ספר לבדיקת קוד שיתוף',
    city: 'חיפה',
    schoolType: 'יסודי',
    totalStaffCount: 40,
    createdAt: new Date(),
  });

  await rounds().create({
    id: randomUUID(),
    organizationId,
    title: 'סבב לבדיקת קוד שיתוף',
    status: 'active',
    shareCode: SHARE_CODE,
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: createCanonicalSurveyDefinition('סבב לבדיקה', 10),
    createdAt: new Date(),
  });
});

test('a code nobody holds finds nothing, however it is shaped', async () => {
  // Each of these returned the round above until 2026-08-23. `%` alone is the
  // whole attack: one character, no knowledge of the school, the questionnaire.
  const guesses = [
    '%',
    'SHALOM-%',
    '%ABCDEFGHJK',
    'SHALOM-_________K',
    '_________________',
    'SHALOM-ABCDEFGHJ_',
    'SHALOM-ABCDEFGHJ%',
  ];

  for (const guess of guesses) {
    assert.strictEqual(
      await rounds().findByShareCode(guess),
      null,
      `"${guess}" must not resolve to a round`,
    );
  }
});

test('the code a school hands out still works, typed any way a person types it', async () => {
  // The negative control, and the reason the old mode existed: the code is read
  // off a slide in a staff meeting and typed by hand. Case and surrounding
  // whitespace are forgiven — on this side now, by normalizing the input rather
  // than by asking the database to compare loosely.
  for (const typed of [
    SHARE_CODE,
    SHARE_CODE.toLowerCase(),
    '  shalom-AbCdEfGhJk  ',
    `\t${SHARE_CODE}\n`,
  ]) {
    const found = await rounds().findByShareCode(typed);
    assert.strictEqual(
      found?.shareCode,
      SHARE_CODE,
      `"${typed}" must reach the round`,
    );
  }
});

test('equality reaches the unique index and ILIKE does not', async () => {
  // The half the audit actually recorded, and the one that needs a table worth
  // planning against: on three rows a sequential scan really is cheaper, so a
  // plan assertion there would be asserting the planner's arithmetic rather
  // than the index. Five hundred closed rounds is enough for the choice to mean
  // something — closed, because one school may hold one active round.
  //
  // Both forms are planned, because the claim is comparative: the query this
  // repository now writes can use `survey_rounds_share_code_key`, and the one
  // it used to write cannot, whatever the row count.
  const filler = Array.from({ length: 500 }, (_, index) => ({
    id: randomUUID(),
    organizationId,
    title: `סבב ${index}`,
    status: 'closed',
    shareCode: `SHALOM-FILL${String(index).padStart(6, '0')}`,
    privacyThreshold: 10,
    startDate: new Date(),
  }));
  await (prisma as any).surveyRound.createMany({ data: filler });
  await (prisma as any).$executeRawUnsafe?.('ANALYZE "survey_rounds"');

  async function planFor(sql: string) {
    const rows = (await (prisma as any).$queryRawUnsafe(
      `EXPLAIN ${sql}`,
      SHARE_CODE,
    )) as Array<Record<string, string>>;
    return rows.map((row) => Object.values(row).join(' ')).join('\n');
  }

  const equality = await planFor(
    'SELECT * FROM "survey_rounds" WHERE "share_code" = $1',
  );
  const insensitive = await planFor(
    'SELECT * FROM "survey_rounds" WHERE "share_code" ILIKE $1',
  );

  assert.match(
    equality,
    /Index Scan|Index Only Scan|Bitmap Index Scan/,
    `equality should reach the unique index, and planned:\n${equality}`,
  );
  assert.match(
    insensitive,
    /Seq Scan/,
    `ILIKE cannot use that index, which is the finding — it planned:\n${insensitive}`,
  );
});

test('two rounds of one school do not collide through a loose match', async () => {
  // A second round whose code shares a prefix with the first. Under `ILIKE` a
  // prefix plus `%` matched both and `findFirst` returned whichever came back
  // first — so even a caller holding a real code could be handed the wrong
  // round. Equality makes each code reach exactly its own.
  const second = 'SHALOM-ABCDEFGHJM';
  await rounds().create({
    id: randomUUID(),
    organizationId,
    title: 'סבב שני',
    status: 'draft',
    shareCode: second,
    privacyThreshold: 10,
    startDate: new Date(),
    createdAt: new Date(),
  });

  assert.strictEqual((await rounds().findByShareCode(SHARE_CODE))?.shareCode, SHARE_CODE);
  assert.strictEqual((await rounds().findByShareCode(second))?.shareCode, second);
  assert.strictEqual(await rounds().findByShareCode('SHALOM-ABCDEFGHJ%'), null);
});
