import assert from 'node:assert';
import test from 'node:test';
import {
  DEFINITION_VERSION_RETENTION,
  InMemorySurveyDefinitionVersionRepository,
} from '../index';
import {
  markCurrentVersion,
  toVersionSummaries,
} from '@/lib/survey-definition-versions';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import type { SurveyDefinition } from '@/lib/types/backend';

const ROUND_ID = 'round-1';

function definition(title: string, disableFirst = false): SurveyDefinition {
  const base = createCanonicalSurveyDefinition(title, 10);
  if (!disableFirst) return base;

  return {
    ...base,
    questions: base.questions.map((question, index) =>
      index === 0 ? { ...question, enabled: false } : question,
    ),
  };
}

test('the history reads newest first', async () => {
  const repo = new InMemorySurveyDefinitionVersionRepository();

  await repo.record(ROUND_ID, definition('ראשון'), new Date('2026-08-05T10:00:00Z'));
  await repo.record(ROUND_ID, definition('שני'), new Date('2026-08-05T11:00:00Z'));

  const versions = await repo.findByRoundId(ROUND_ID);
  assert.deepStrictEqual(
    versions.map((version) => version.definition.title),
    ['שני', 'ראשון'],
  );
});

test('two saves in the same millisecond keep the order they were written in', async () => {
  const repo = new InMemorySurveyDefinitionVersionRepository();
  const sameInstant = new Date('2026-08-05T10:00:00.000Z');

  await repo.record(ROUND_ID, definition('ראשון'), sameInstant);
  await repo.record(ROUND_ID, definition('שני'), sameInstant);

  const versions = await repo.findByRoundId(ROUND_ID);
  assert.strictEqual(versions[0].definition.title, 'שני');
});

test('a version is stored as a copy, not as a live reference', async () => {
  const repo = new InMemorySurveyDefinitionVersionRepository();
  const original = definition('מקורי');

  await repo.record(ROUND_ID, original);
  original.questions[0].text = 'נערך אחרי השמירה';

  const [stored] = await repo.findByRoundId(ROUND_ID);
  assert.notStrictEqual(stored.definition.questions[0].text, 'נערך אחרי השמירה');
});

test('only the retention window is kept, and it keeps the newest', async () => {
  const repo = new InMemorySurveyDefinitionVersionRepository();

  for (let index = 0; index < DEFINITION_VERSION_RETENTION + 5; index += 1) {
    await repo.record(
      ROUND_ID,
      definition(`גרסה ${index}`),
      new Date(Date.UTC(2026, 7, 5, 10, index)),
    );
  }

  const versions = await repo.findByRoundId(ROUND_ID);
  assert.strictEqual(versions.length, DEFINITION_VERSION_RETENTION);
  assert.strictEqual(versions[0].definition.title, `גרסה ${DEFINITION_VERSION_RETENTION + 4}`);
  assert.strictEqual(versions.at(-1)?.definition.title, 'גרסה 5');
});

test('pruning one round does not touch another round', async () => {
  const repo = new InMemorySurveyDefinitionVersionRepository();

  await repo.record('round-other', definition('של בית ספר אחר'));
  for (let index = 0; index < DEFINITION_VERSION_RETENTION + 3; index += 1) {
    await repo.record(ROUND_ID, definition(`גרסה ${index}`));
  }

  assert.strictEqual((await repo.findByRoundId('round-other')).length, 1);
});

test('a version id from another round reads as missing', async () => {
  const repo = new InMemorySurveyDefinitionVersionRepository();
  const recorded = await repo.record('round-other', definition('של בית ספר אחר'));

  assert.strictEqual(await repo.findById(ROUND_ID, recorded.id), null);
  assert.notStrictEqual(await repo.findById('round-other', recorded.id), null);
});

test('a summary counts the questionnaire it holds, and names the current one', async () => {
  const repo = new InMemorySurveyDefinitionVersionRepository();
  await repo.record(ROUND_ID, definition('ישן', true), new Date('2026-08-05T10:00:00Z'));
  await repo.record(ROUND_ID, definition('נוכחי'), new Date('2026-08-05T11:00:00Z'));

  const [current, previous] = toVersionSummaries(await repo.findByRoundId(ROUND_ID));

  assert.strictEqual(current.title, 'נוכחי');
  assert.strictEqual(current.isCurrent, true);
  assert.strictEqual(current.enabledQuestionCount, current.questionCount);

  assert.strictEqual(previous.isCurrent, false);
  assert.strictEqual(previous.enabledQuestionCount, previous.questionCount - 1);
});

test('the summary read answers exactly what summarising the whole list answers', async () => {
  // The list route reads summaries and never the definitions. The two stores
  // compute them differently — this one in JavaScript, the durable one in SQL
  // over the `jsonb` column — so the standard both are held to is stated here,
  // in terms of the read that was replaced rather than in restated numbers.
  const repo = new InMemorySurveyDefinitionVersionRepository();
  await repo.record(ROUND_ID, definition('ישן', true), new Date('2026-08-05T10:00:00Z'));
  await repo.record(ROUND_ID, definition('נוכחי'), new Date('2026-08-05T11:00:00Z'));
  await repo.record('round-other', definition('של בית ספר אחר'));

  assert.deepStrictEqual(
    markCurrentVersion(await repo.findSummariesByRoundId(ROUND_ID)),
    toVersionSummaries(await repo.findByRoundId(ROUND_ID)),
  );
});

test('a summary carries no questionnaire', async () => {
  // The point of the method. Without this the store could satisfy every
  // assertion above by reading everything and deleting a field on the way out.
  const repo = new InMemorySurveyDefinitionVersionRepository();
  await repo.record(ROUND_ID, definition('נוכחי'));

  const [summary] = await repo.findSummariesByRoundId(ROUND_ID);
  assert.deepStrictEqual(Object.keys(summary).sort(), [
    'enabledQuestionCount',
    'id',
    'questionCount',
    'savedAt',
    'title',
  ]);
});

test('the summary of a round with no history is empty, not the other round\'s', async () => {
  const repo = new InMemorySurveyDefinitionVersionRepository();
  await repo.record('round-other', definition('של בית ספר אחר'));

  assert.deepStrictEqual(await repo.findSummariesByRoundId(ROUND_ID), []);
});
