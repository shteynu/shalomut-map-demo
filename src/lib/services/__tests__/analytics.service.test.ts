import assert from 'node:assert';
import { test } from 'node:test';
import { surveyInstrument } from '../../shalomut-source';
import { AnswerValue, SurveyResponseRecord } from '../../types/backend';
import { AnalyticsService } from '../analytics.service';
import { RoundService } from '../round.service';
import { SurveyService } from '../survey.service';

test('AnalyticsService.computeStatus returns correct status thresholds', () => {
  assert.strictEqual(AnalyticsService.computeStatus(100), 'green');
  assert.strictEqual(AnalyticsService.computeStatus(75), 'green');
  assert.strictEqual(AnalyticsService.computeStatus(74), 'yellow');
  assert.strictEqual(AnalyticsService.computeStatus(50), 'yellow');
  assert.strictEqual(AnalyticsService.computeStatus(49), 'red');
  assert.strictEqual(AnalyticsService.computeStatus(0), 'red');
});

test('AnalyticsService locks results when total responses < privacyThreshold', () => {
  const roundId = 'round_test_1';
  const responses: SurveyResponseRecord[] = []; // 0 responses < threshold 10

  const result = AnalyticsService.calculateRoundAnalytics(roundId, 10, responses);

  assert.strictEqual(result.isLocked, true);
  assert.strictEqual(result.totalResponses, 0);
  assert.strictEqual(result.privacyThreshold, 10);
  assert.strictEqual(result.contractVersion, '2.0');
  assert.deepStrictEqual(result.dimensionScores, {});
  assert.deepStrictEqual(result.questionAggregates, {});
});

test('AnalyticsService unlocks results and computes correct scores when responses >= privacyThreshold', () => {
  const roundId = 'round_test_2';
  const responses: SurveyResponseRecord[] = [];

  // Generate 10 uniform 'green' responses
  for (let i = 0; i < 10; i++) {
    const answers = surveyInstrument.questions.map((q) => ({
      questionId: q.id,
      dimensionId: q.dimensionId,
      value: 'green' as AnswerValue,
      score: 100 as const,
    }));

    responses.push({
      id: `resp_${i}`,
      roundId,
      answers,
      submittedAt: new Date(),
    });
  }

  const result = AnalyticsService.calculateRoundAnalytics(roundId, 10, responses);

  assert.strictEqual(result.isLocked, false);
  assert.strictEqual(result.contractVersion, '2.0');
  assert.strictEqual(result.totalResponses, 10);
  assert.strictEqual(Object.keys(result.questionAggregates).length, 24);
  assert.strictEqual(result.dimensionScores['self-expression'].isLocked, false);
  assert.strictEqual(result.dimensionScores['self-expression'].averageScore, 100);
  assert.strictEqual(result.dimensionScores['self-expression'].computedStatus, 'green');
});

test('SurveyService processes valid submissions and validates missing fields', () => {
  const validAnswers = surveyInstrument.questions.map((q) => ({
    questionId: q.id,
    dimensionId: q.dimensionId,
    value: 'yellow' as AnswerValue,
  }));

  const validSubmission = SurveyService.processSubmission({
    roundId: 'round_valid',
    answers: validAnswers,
  });

  assert.strictEqual(validSubmission.result.success, true);
  assert.ok(validSubmission.result.responseId);
  assert.strictEqual(validSubmission.record?.answers[0].score, 60);

  // Test incomplete submission (only 5 answers instead of 24)
  const incompleteSubmission = SurveyService.processSubmission({
    roundId: 'round_invalid',
    answers: validAnswers.slice(0, 5),
  });

  assert.strictEqual(incompleteSubmission.result.success, false);
  assert.ok(incompleteSubmission.result.error?.includes('24 questions'));
});

test('SurveyService accepts an omitted optional dynamic question but still requires every required question', () => {
  const expectedQuestions = surveyInstrument.dimensions.map(
    (dimension, index) => ({
      id: `dynamic-${dimension.id}-${index + 1}`,
      dimensionId: dimension.id,
      required: index !== surveyInstrument.dimensions.length - 1,
    }),
  );
  const answers = expectedQuestions.slice(0, -1).map((question) => ({
    questionId: question.id,
    dimensionId: question.dimensionId,
    value: 'green' as AnswerValue,
  }));

  const optionalOmitted = SurveyService.processSubmission(
    { roundId: 'round_dynamic_optional', answers },
    expectedQuestions,
  );
  assert.strictEqual(optionalOmitted.result.success, true);

  const requiredOmitted = SurveyService.processSubmission(
    {
      roundId: 'round_dynamic_required',
      answers: answers.slice(1),
    },
    expectedQuestions,
  );
  assert.strictEqual(requiredOmitted.result.success, false);
});

test('RoundService creates valid round with default privacy threshold', () => {
  const round = RoundService.createRound({
    organizationId: 'org_123',
    title: 'Round 1 2026',
  });

  assert.strictEqual(round.organizationId, 'org_123');
  assert.strictEqual(round.status, 'active');
  assert.strictEqual(round.privacyThreshold, 10);
  assert.strictEqual(round.surveyDefinition?.questions.length, 24);
  assert.ok(round.shareCode.startsWith('SHALOM-'));
});

test('RoundService rejects activating a questionnaire without all eight dimensions', () => {
  const questions = surveyInstrument.questions.filter(
    (question) => question.dimensionId !== 'meaning',
  );

  assert.throws(
    () =>
      RoundService.createRound({
        organizationId: 'org_invalid_definition',
        title: 'Invalid round',
        surveyDefinition: {
          title: 'Invalid round',
          audience: 'צוות',
          estimatedMinutes: 10,
          minimumResponses: 10,
          introText: 'פתיח',
          anonymityText: 'אנונימי',
          questions: questions.map((question) => ({
            ...question,
            enabled: true,
            answerMode: 'סקאלת צבעים',
          })),
        },
      }),
    /all eight dimensions/i,
  );
});
