/**
 * Demographic answers do not cross the model boundary.
 *
 * This is a decision, not an accident of the current code, and it is the third
 * thing phase 2 of `docs/default-research-instrument-plan-2026-08-14.md` owes an
 * answer to. The research instrument asks sixteen background questions — age
 * band, gender, marital status, children, education, role, tenure, FTE, hours,
 * commute, salary band, school type, work mode. In a staffroom of thirty to
 * sixty those combine into a re-identification set long before any one of them
 * does on its own.
 *
 * Nothing about them is needed to write an insight. The AI service is asked for
 * a reading of eight dimension scores and their question aggregates; a salary
 * band adds no signal there and would be a subprocessor holding a demographic
 * profile of a named school. So the boundary is drawn where it costs nothing:
 * background answers are aggregated, suppressed and displayed inside Core, and
 * the payload sent over MCP is analytic-only.
 *
 * `AnalyticsService` enforces it by filtering to analytic questions before it
 * builds a single aggregate, so a background question has no aggregate to be
 * encoded. That is one `.filter` away from being untrue, which is why it is
 * pinned here against the encoded payload rather than against the filter.
 */
import assert from 'node:assert';
import test from 'node:test';

import { encodeAnalyticsInput } from '../../analytics-encoder';
import { AnalyticsService } from '../../services/analytics.service';
import { createCanonicalSurveyDefinition } from '../../survey-definition';
import { createSurveyDefinitionHash } from '../../survey-definition-hash';
import {
  AnswerValue,
  SurveyDefinition,
  SurveyResponseRecord,
  SurveyRound,
} from '../../types/backend';

const ROUND_ID = 'round_background_boundary';
const THRESHOLD = 10;

/** The canonical 24, plus the demographic items the research instrument adds. */
const BACKGROUND_QUESTION_IDS = ['age-band', 'salary-band', 'commute-minutes'] as const;

function definitionWithBackgroundQuestions(): SurveyDefinition {
  const canonical = createCanonicalSurveyDefinition('סבב עם רקע', THRESHOLD);

  return {
    ...canonical,
    questions: [
      ...canonical.questions,
      {
        id: 'age-band',
        text: 'מהי קבוצת הגיל שלך?',
        required: false,
        enabled: true,
        kind: 'background',
        answerMode: 'single-choice',
        options: [
          { value: '21-30', label: '21-30' },
          { value: '31-40', label: '31-40' },
        ],
      },
      {
        id: 'salary-band',
        text: 'מהי רמת השכר שלך?',
        required: false,
        enabled: true,
        kind: 'background',
        answerMode: 'single-choice',
        options: [
          { value: 'low', label: 'נמוך' },
          { value: 'high', label: 'גבוה' },
        ],
      },
      {
        id: 'commute-minutes',
        text: 'כמה דקות נמשכת הנסיעה שלך לבית הספר?',
        required: false,
        enabled: true,
        kind: 'background',
        answerMode: 'number',
      },
    ],
  };
}

function roundWithBackgroundQuestions(): SurveyRound {
  return {
    id: ROUND_ID,
    organizationId: 'org_background_boundary',
    title: 'סבב עם רקע',
    status: 'active',
    shareCode: 'BACKGROUND',
    privacyThreshold: THRESHOLD,
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    surveyDefinition: definitionWithBackgroundQuestions(),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  };
}

/** Enough answered responses to unlock, each carrying demographics too. */
function responsesWithDemographics(definition: SurveyDefinition): SurveyResponseRecord[] {
  return Array.from({ length: THRESHOLD }, (_, index) => ({
    id: `resp_${index}`,
    roundId: ROUND_ID,
    submittedAt: new Date('2026-08-02T00:00:00.000Z'),
    answers: [
      ...definition.questions
        .filter((question) => question.kind === 'analytic')
        .map((question) => ({
          questionId: question.id,
          dimensionId: question.dimensionId,
          value: 'green' as AnswerValue,
          score: 100,
        })),
      { questionId: 'age-band', value: index < 2 ? '21-30' : '31-40' },
      { questionId: 'salary-band', value: index < 3 ? 'low' : 'high' },
      { questionId: 'commute-minutes', value: '45' },
    ],
  }));
}

test('a background question produces no aggregate', () => {
  const round = roundWithBackgroundQuestions();
  const analytics = AnalyticsService.calculateDynamicRoundAnalytics(
    round,
    responsesWithDemographics(round.surveyDefinition!),
  );

  assert.strictEqual(analytics.isLocked, false);
  assert.strictEqual(Object.keys(analytics.questionAggregates).length, 24);

  for (const questionId of BACKGROUND_QUESTION_IDS) {
    assert.strictEqual(
      analytics.questionAggregates[questionId],
      undefined,
      `${questionId} became an aggregate, and every aggregate is sent to the model`,
    );
  }
});

test('the payload sent over MCP mentions no background question at all', () => {
  const round = roundWithBackgroundQuestions();
  const analytics = AnalyticsService.calculateDynamicRoundAnalytics(
    round,
    responsesWithDemographics(round.surveyDefinition!),
  );

  // Serialised and searched as text, deliberately. A structural assertion only
  // covers the fields someone thought to check; this covers a demographic id or
  // its Hebrew text appearing anywhere in the payload, including somewhere new.
  const wire = JSON.stringify(encodeAnalyticsInput(analytics));

  for (const questionId of BACKGROUND_QUESTION_IDS) {
    assert.ok(!wire.includes(questionId), `the payload names ${questionId}`);
  }
  assert.ok(!wire.includes('שכר'), 'the payload carries the salary question text');
  assert.ok(!wire.includes('גיל'), 'the payload carries the age question text');
});

test('adding a background question does not change the questionnaire identity', () => {
  // The hash is how Core recognises the questionnaire an AI result was written
  // about. If a demographic question moved it, adding one to a round would
  // invalidate results that are still perfectly valid — and it would also mean
  // the hash is describing something the model never saw.
  const canonical = createCanonicalSurveyDefinition('סבב עם רקע', THRESHOLD);

  assert.strictEqual(
    createSurveyDefinitionHash(definitionWithBackgroundQuestions().questions),
    createSurveyDefinitionHash(canonical.questions),
  );
});

test('an unanswered demographic question cannot lock a round', () => {
  // ADR-004 makes unlocked analysis all-or-nothing across every *analysed*
  // question. A background question is not one, so leaving it blank must not
  // take the school's whole result away.
  const round = roundWithBackgroundQuestions();
  const responses = responsesWithDemographics(round.surveyDefinition!).map(
    (response) => ({
      ...response,
      answers: response.answers.filter(
        (answer) => !BACKGROUND_QUESTION_IDS.includes(answer.questionId as never),
      ),
    }),
  );

  const analytics = AnalyticsService.calculateDynamicRoundAnalytics(round, responses);

  assert.strictEqual(analytics.isLocked, false);
  assert.strictEqual(analytics.totalResponses, THRESHOLD);
});
