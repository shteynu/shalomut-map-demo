/**
 * How often a round's numbers are derived from its answer rows.
 *
 * `getAnalyticsForRound` used to read every `SurveyResponse` of the round with
 * all of its `QuestionAnswer` rows, every time anyone asked — on each of the
 * eight manager screens, up to four more times for the dashboard's comparison,
 * and again for every AI request. At 300 staff on the 126-question instrument
 * that is some 38 000 rows to answer a question whose answer had not changed,
 * and for a round still collecting, to produce a locked payload that carries no
 * numbers at all.
 *
 * These tests are about the reads, so they count them. What the numbers are is
 * `analytics.service.test.ts`; that the two paths agree about them is asserted
 * here, because two ways of producing one payload is how they drift.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import {
  createMeasurementSnapshotHash,
  createSurveyDefinitionHash,
} from '../../survey-definition-hash';
import { surveyInstrument } from '../../shalomut-source';
import type {
  AnswerValue,
  SurveyResponseRecord,
  SurveyRound,
} from '../../types/backend';
import { AnalyticsService } from '../analytics.service';

const ROUND_ID = 'round-once';
const ORGANIZATION_ID = 'org-once';

function roundWith(overrides: Partial<SurveyRound> = {}): SurveyRound {
  return {
    id: ROUND_ID,
    organizationId: ORGANIZATION_ID,
    title: 'סבב בדיקה',
    status: 'closed',
    shareCode: 'SHALOM-ONCE',
    privacyThreshold: 10,
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    surveyDefinition: createCanonicalSurveyDefinition('סבב בדיקה', 10),
    ...overrides,
  };
}

/** Twelve identical answer sheets: above the threshold, so nothing is locked. */
function responses(count = 12): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `response-${index}`,
    roundId: ROUND_ID,
    answers: surveyInstrument.questions.map((question) => ({
      questionId: question.id,
      dimensionId: question.dimensionId,
      value: 'green' as AnswerValue,
      score: 100 as const,
    })),
    submittedAt: new Date('2026-08-02T00:00:00.000Z'),
  }));
}

/**
 * The survey repository, with a tally of how many times each round's answer
 * rows were actually read.
 */
class CountingSurveyRepository extends InMemorySurveyRepository {
  public answerReads = 0;

  public async findResponsesByRoundId(roundId: string) {
    this.answerReads += 1;
    return super.findResponsesByRoundId(roundId);
  }
}

function repositories(round: SurveyRound, stored = responses()) {
  return {
    roundRepo: new InMemoryRoundRepository([round]),
    surveyRepo: new CountingSurveyRepository(stored),
  };
}

async function analyticsFor(repos: ReturnType<typeof repositories>) {
  const analytics = await AnalyticsService.getAnalyticsForRound(
    ROUND_ID,
    repos.roundRepo,
    repos.surveyRepo,
  );
  assert.ok(analytics, 'the round exists, so it has analytics');
  return analytics;
}

test('a round that is still collecting reads no answer rows at all', async () => {
  for (const status of ['draft', 'active'] as const) {
    const repos = repositories(roundWith({ status }));

    const analytics = await analyticsFor(repos);

    assert.equal(repos.surveyRepo.answerReads, 0);
    assert.equal(analytics.isLocked, true);
    assert.equal(analytics.totalResponses, 12);
  }
});

test('the locked payload is the same one the full calculation produces', async () => {
  // The whole justification for the short-circuit: a collecting round is
  // locked whatever its answers say, so the two paths must be one payload.
  const round = roundWith({ status: 'active' });
  const repos = repositories(round);

  const short = await analyticsFor(repos);
  const full = AnalyticsService.calculateDynamicRoundAnalytics(
    round,
    responses(),
  );

  assert.deepEqual(
    { ...short, calculatedAt: null },
    { ...full, calculatedAt: null },
  );
});

test('a round that has stopped collecting derives its numbers once', async () => {
  const repos = repositories(roundWith());

  const first = await analyticsFor(repos);
  const second = await analyticsFor(repos);

  assert.equal(repos.surveyRepo.answerReads, 1);
  // Including `calculatedAt`: a published round was calculated at one moment,
  // and a second reader is being told about that moment, not about theirs.
  assert.deepEqual(second, first);
  assert.equal(second.isLocked, false);
});

test('a response that arrives after publication is not answered from the copy', async () => {
  const repos = repositories(roundWith());
  await analyticsFor(repos);

  await repos.surveyRepo.saveResponse(responses(13)[12]);
  const after = await analyticsFor(repos);

  assert.equal(repos.surveyRepo.answerReads, 2);
  assert.equal(after.totalResponses, 13);
});

test('a questionnaire that changed is not answered from the copy', async () => {
  const repos = repositories(roundWith());
  const first = await analyticsFor(repos);

  // The same round, asked a shorter questionnaire. Nothing about the responses
  // changed, so only the definition hash can catch this.
  const definition = createCanonicalSurveyDefinition('סבב בדיקה', 10);
  await repos.roundRepo.update(ROUND_ID, {
    surveyDefinition: {
      ...definition,
      questions: definition.questions.map((question, index) => ({
        ...question,
        enabled: index > 0,
      })),
    },
  });
  const second = await analyticsFor(repos);

  assert.equal(repos.surveyRepo.answerReads, 2);
  assert.notEqual(
    second.surveyDefinitionHash,
    first.surveyDefinitionHash,
  );
});

test('a privacy threshold that was raised is not answered from the copy', async () => {
  // The threshold decides whether any of these numbers may be shown at all.
  // A copy published under the old one would keep showing them.
  const repos = repositories(roundWith());
  const published = await analyticsFor(repos);
  assert.equal(published.isLocked, false);

  await repos.roundRepo.update(ROUND_ID, { privacyThreshold: 20 });
  const after = await analyticsFor(repos);

  assert.equal(after.isLocked, true);
  assert.equal(repos.surveyRepo.answerReads, 2);
});

test('the measurement hash is the wider of the two, so one check is enough', async () => {
  /*
   * What the basis check rests on. `surveyDefinitionHash` covers the enabled
   * analytic questions with their ids, dimensions and text;
   * `createMeasurementSnapshotHash` covers all of that plus `scaleId` and
   * `polarity`. Comparing the wider one therefore catches every change the
   * narrower one would — and the day those projections stop overlapping, the
   * check would quietly stop noticing a rewritten question.
   */
  const definition = createCanonicalSurveyDefinition('סבב בדיקה', 10);
  const rewritten = {
    ...definition,
    questions: definition.questions.map((question, index) =>
      index === 0 ? { ...question, text: `${question.text} (מנוסח מחדש)` } : question,
    ),
  };

  assert.notEqual(
    createSurveyDefinitionHash(rewritten.questions),
    createSurveyDefinitionHash(definition.questions),
  );
  assert.notEqual(
    createMeasurementSnapshotHash(rewritten.questions),
    createMeasurementSnapshotHash(definition.questions),
  );
});

test('the school context is read from the round, never from the copy', async () => {
  // It is what a manager typed about the school, not something the answers
  // produced, and it stays editable after the round has closed.
  const repos = repositories(roundWith());
  await analyticsFor(repos);

  const backgroundContext = {
    notes: 'שנה קשה',
    audience: 'צוות חינוכי',
    sicknessDaysThisQuarter: 12,
    newStaffMembers: 3,
    studentCount: 420,
    socioEconomicIndex: 5,
    classesPerGrade: { a: 3 },
  };
  await repos.roundRepo.update(ROUND_ID, { backgroundContext });
  const after = await analyticsFor(repos);

  assert.deepEqual(after.backgroundContext, backgroundContext);
  assert.equal(repos.surveyRepo.answerReads, 1, 'the numbers were unchanged');
});

test('a round the school no longer has is still no analytics', async () => {
  const repos = repositories(roundWith());

  assert.equal(
    await AnalyticsService.getAnalyticsForRound(
      'round-that-never-was',
      repos.roundRepo,
      repos.surveyRepo,
    ),
    null,
  );
  assert.equal(repos.surveyRepo.answerReads, 0);
});
