/**
 * The version table as database behaviour.
 *
 * Three things about the questionnaire history exist only in PostgreSQL and the
 * in-memory repository can only imitate them: the cascade that removes a
 * round's versions with the round, the ordering the prune depends on when
 * several saves share a millisecond, and — since 2026-08-23 — the summary read,
 * which computes the history line's title and counts inside the `jsonb` column
 * with SQL that has no JavaScript counterpart to agree with by construction.
 * The retention cap is repository code, but it is worth proving against a real
 * table because it deletes rows.
 *
 * The summary tests below are written as comparisons against
 * `summariseVersion` rather than as restated numbers. Two stores that disagree
 * about the same rows is how the share-code defect survived for months, and the
 * only assertion that catches it is the one that puts them side by side.
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
import { summariseVersion } from '../../survey-definition-versions';
import type { SurveyDefinition } from '../../types/backend';

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

/** A questionnaire with the first question disabled, so the counts differ. */
function withFirstDisabled(title: string): SurveyDefinition {
  const base = createCanonicalSurveyDefinition(title, 10);
  return {
    ...base,
    questions: base.questions.map((question, index) =>
      index === 0 ? { ...question, enabled: false } : question,
    ),
  };
}

test('the summary read answers what summarising the whole list answers', async () => {
  // The comparison this file exists for. PostgreSQL computes the title with
  // `->>` and the counts with `jsonb_array_elements`; `summariseVersion` reads
  // a parsed object. Nothing makes them agree except being checked.
  await versionRepo.record(
    roundId,
    withFirstDisabled('גרסה ישנה'),
    new Date('2026-03-01T08:00:00.000Z'),
  );
  await versionRepo.record(
    roundId,
    createCanonicalSurveyDefinition('גרסה נוכחית', 10),
    new Date('2026-03-01T09:00:00.000Z'),
  );

  const summaries = await versionRepo.findSummariesByRoundId(roundId);
  const whole = await versionRepo.findByRoundId(roundId);

  assert.deepStrictEqual(summaries, whole.map(summariseVersion));
  // And the fixture is one the comparison can fail on: without this, two
  // stores that both counted every question would look like agreement.
  assert.notStrictEqual(summaries[1].enabledQuestionCount, summaries[1].questionCount);
});

test('a question with no enabled key is counted the same by both', async () => {
  // The one place the two could honestly diverge. In SQL a missing key makes
  // `("question" ->> 'enabled')::boolean` NULL, which the WHERE drops; in
  // JavaScript `question.enabled` is `undefined`, which the filter drops. Same
  // answer, arrived at by different rules, so it is worth pinning.
  const base = createCanonicalSurveyDefinition('בלי דגל', 10);
  const [first, ...rest] = base.questions;
  const withoutFlag = { ...first } as Record<string, unknown>;
  delete withoutFlag.enabled;
  const definition = {
    ...base,
    questions: [withoutFlag, ...rest],
  } as unknown as SurveyDefinition;

  await versionRepo.record(roundId, definition);

  const [summary] = await versionRepo.findSummariesByRoundId(roundId);
  const [whole] = await versionRepo.findByRoundId(roundId);

  assert.deepStrictEqual(summary, summariseVersion(whole));
  assert.strictEqual(summary.enabledQuestionCount, summary.questionCount - 1);
});

test('a summary carries no questionnaire', async () => {
  // The point of the method: the definitions must not leave the database. A
  // store that read everything and dropped a field on the way out would pass
  // every other test here.
  await versionRepo.record(roundId, createCanonicalSurveyDefinition('שאלון', 10));

  const [summary] = await versionRepo.findSummariesByRoundId(roundId);
  assert.deepStrictEqual(Object.keys(summary).sort(), [
    'enabledQuestionCount',
    'id',
    'questionCount',
    'savedAt',
    'title',
  ]);
});

test('the summary is scoped to its round', async () => {
  // `round_id` is a bound parameter in a hand-written statement, which is the
  // one place in this repository where that scoping is not Prisma's to enforce.
  await versionRepo.record(roundId, createCanonicalSurveyDefinition('שלנו', 10));
  const otherRoundId = await createRound();

  assert.deepStrictEqual(await versionRepo.findSummariesByRoundId(otherRoundId), []);
  assert.strictEqual((await versionRepo.findSummariesByRoundId(roundId)).length, 1);
});

test('the summary keeps the order the history is read in, up to the retention cap', async () => {
  const start = Date.parse('2026-04-01T08:00:00.000Z');
  for (let index = 0; index < DEFINITION_VERSION_RETENTION + 2; index += 1) {
    await versionRepo.record(
      roundId,
      createCanonicalSurveyDefinition(`גרסה ${index}`, 10),
      new Date(start + index * 60_000),
    );
  }

  const summaries = await versionRepo.findSummariesByRoundId(roundId);
  assert.strictEqual(summaries.length, DEFINITION_VERSION_RETENTION);
  assert.deepStrictEqual(
    summaries,
    (await versionRepo.findByRoundId(roundId)).map(summariseVersion),
  );
});
