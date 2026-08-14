/**
 * A questionnaire stored before `kind` existed still has to come back as the
 * domain type describes it.
 *
 * `SurveyRound.surveyDefinition` used to be a `structuredClone` of whatever the
 * JSON column held, typed as a `SurveyDefinition` on trust. Everything that
 * parses the definition was fine, because the parser is where the defaults for
 * older shapes live. The builder is the one screen that reads the type at its
 * word, and against a definition written before `kind` it showed eight empty
 * dimension tabs above twenty-four questions: each one was neither analytic nor
 * background, so it counted towards nothing.
 */
import assert from 'node:assert';
import test from 'node:test';

import { PrismaRoundRepository } from '..';
import { MinimalPrismaClient } from '../prisma/prisma-client';

/** The shape the column actually holds for a round saved before `kind`. */
const legacyDefinition = {
  title: 'סבב ותיק',
  audience: 'כלל צוות ההוראה',
  estimatedMinutes: 4,
  minimumResponses: 10,
  introText: 'מבוא',
  anonymityText: 'אנונימיות',
  questions: [
    {
      id: 'balance-1',
      text: 'אני מצליח לשמור על גבולות',
      dimensionId: 'balance',
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    },
  ],
};

function repositoryReturning(surveyDefinition: unknown): PrismaRoundRepository {
  const record = {
    id: 'round_legacy',
    organizationId: 'org_legacy',
    title: 'סבב ותיק',
    status: 'active',
    shareCode: 'LEGACY',
    privacyThreshold: 10,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    surveyDefinition,
  };

  return new PrismaRoundRepository({
    surveyRound: {
      findUnique: async () => record,
    },
  } as unknown as MinimalPrismaClient);
}

test('a question stored without a kind reads back as analytic', async () => {
  const round = await repositoryReturning(legacyDefinition).findById('round_legacy');
  const question = round?.surveyDefinition?.questions[0];

  assert.ok(question);
  assert.strictEqual(question.kind, 'analytic');
  assert.strictEqual(
    question.kind === 'analytic' ? question.scaleId : undefined,
    'wellbeing-colour',
  );
  assert.strictEqual(
    question.kind === 'analytic' ? question.polarity : undefined,
    'positive',
  );
  assert.strictEqual(
    question.kind === 'analytic' ? question.dimensionId : undefined,
    'balance',
  );
});

test('a definition that will not parse is still handed over', async () => {
  // Refusing it would take the round off every manager screen rather than
  // letting the manager repair it, which is a worse answer than the one this
  // normalisation exists to give.
  const broken = { ...legacyDefinition, questions: [{ id: '', text: '' }] };
  const round = await repositoryReturning(broken).findById('round_legacy');

  assert.ok(round?.surveyDefinition);
  assert.strictEqual(round.surveyDefinition.questions.length, 1);
});

test('a round with no questionnaire has none, rather than an empty one', async () => {
  const round = await repositoryReturning(null).findById('round_legacy');

  assert.strictEqual(round?.surveyDefinition, undefined);
});

test('a background question survives the read unchanged', async () => {
  const round = await repositoryReturning({
    ...legacyDefinition,
    questions: [
      ...legacyDefinition.questions,
      {
        id: 'age-band',
        text: 'מהי קבוצת הגיל שלך?',
        kind: 'background',
        answerMode: 'single-choice',
        required: false,
        enabled: true,
        sectionId: 'פרטי רקע',
        options: [
          { value: '21-30', label: '21-30' },
          { value: '31-40', label: '31-40' },
        ],
      },
    ],
  }).findById('round_legacy');

  const question = round?.surveyDefinition?.questions.find(
    (candidate) => candidate.id === 'age-band',
  );

  assert.ok(question);
  assert.strictEqual(question.kind, 'background');
  assert.strictEqual(question.sectionId, 'פרטי רקע');
  assert.strictEqual(
    question.kind === 'background' ? question.options?.length : undefined,
    2,
  );
});
