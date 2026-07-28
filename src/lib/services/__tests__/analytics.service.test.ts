import assert from 'node:assert';
import { test } from 'node:test';
import { surveyInstrument } from '../../shalomut-source';
import { AnswerValue, SurveyResponseRecord } from '../../types/backend';
import { AnalyticsService } from '../analytics.service';
import {
  DEFAULT_PRIVACY_THRESHOLD,
  MINIMUM_PRIVACY_THRESHOLD,
  createCanonicalSurveyDefinition,
} from '../../survey-definition';
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

test('RoundService starts a round without a questionnaire as an empty draft', () => {
  const round = RoundService.createRound({
    organizationId: 'org_123',
    title: 'Round 1 2026',
  });

  assert.strictEqual(round.organizationId, 'org_123');
  // Nothing is pre-filled, so the round cannot be distributed until the manager
  // builds a questionnaire that covers all eight dimensions.
  assert.strictEqual(round.status, 'draft');
  assert.strictEqual(round.surveyDefinition?.questions.length, 0);
  assert.strictEqual(round.privacyThreshold, DEFAULT_PRIVACY_THRESHOLD);
  // Ten respondents is the product requirement, so it is also where a round
  // the manager never configured starts.
  assert.strictEqual(DEFAULT_PRIVACY_THRESHOLD, 10);
  assert.ok(round.shareCode.startsWith('SHALOM-'));
});

test('RoundService activates a round whose questionnaire covers all eight dimensions', () => {
  const round = RoundService.createRound({
    organizationId: 'org_123',
    title: 'Round 1 2026',
    surveyDefinition: createCanonicalSurveyDefinition('Round 1 2026', 10),
  });

  assert.strictEqual(round.status, 'active');
  assert.strictEqual(round.surveyDefinition?.questions.length, 24);
  assert.strictEqual(round.privacyThreshold, 10);
});

test('RoundService keeps a questionnaire without all eight dimensions in draft', () => {
  const questions = surveyInstrument.questions.filter(
    (question) => question.dimensionId !== 'meaning',
  );

  const round = RoundService.createRound({
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
  });

  assert.strictEqual(round.status, 'draft');
});

test('AnalyticsService returns a locked result for a draft round whose questionnaire is unfinished', () => {
  // A manager who is still building the questionnaire keeps opening the manager
  // screens, and every one of them computes analytics. An unfinished draft has
  // no results yet, so it must come back locked instead of throwing.
  const round = RoundService.createRound({
    organizationId: 'org_draft_analytics',
    title: 'טיוטה בבנייה',
  });

  const result = AnalyticsService.calculateDynamicRoundAnalytics(round, []);

  assert.strictEqual(result.isLocked, true);
  assert.strictEqual(result.totalResponses, 0);
  assert.deepStrictEqual(result.dimensionScores, {});
  assert.deepStrictEqual(result.questionAggregates, {});
});

test('AnalyticsService keeps a partially built questionnaire locked even with responses', () => {
  const questions = surveyInstrument.questions.filter(
    (question) => question.dimensionId !== 'meaning',
  );
  const round = RoundService.createRound({
    organizationId: 'org_partial_analytics',
    title: 'שאלון חלקי',
    privacyThreshold: 1,
    surveyDefinition: {
      title: 'שאלון חלקי',
      audience: 'צוות',
      estimatedMinutes: 10,
      minimumResponses: 1,
      introText: 'פתיח',
      anonymityText: 'אנונימי',
      questions: questions.map((question) => ({
        ...question,
        enabled: true,
        answerMode: 'סקאלת צבעים' as const,
      })),
    },
  });
  const responses: SurveyResponseRecord[] = [
    {
      id: 'response_partial_1',
      roundId: round.id,
      submittedAt: new Date(),
      answers: questions.map((question) => ({
        questionId: question.id,
        dimensionId: question.dimensionId,
        value: 'green' as AnswerValue,
        score: 100,
      })),
    },
  ];

  const result = AnalyticsService.calculateDynamicRoundAnalytics(round, responses);

  // Seven of eight dimensions cannot produce the fixed eight-stone Dashboard
  // output, so the round stays locked until the questionnaire is complete.
  assert.strictEqual(result.isLocked, true);
  assert.strictEqual(result.totalResponses, 1);
});

test('a locked 5.0 round carries no distributions across the service boundary', () => {
  // The mirror of the Python refusal (tests/test_contract_v5.py): the consumer
  // rejects a locked payload that carries aggregates, and the producer must
  // never build one. A distribution below the privacy threshold is exactly the
  // shape of data that could identify a single respondent.
  const previousVersion = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '5.0';

  try {
    const round = RoundService.createRound({
      organizationId: 'org_locked_v5',
      title: 'סבב נעול',
      privacyThreshold: 10,
      surveyDefinition: createCanonicalSurveyDefinition('סבב נעול', 10),
    });
    const responses: SurveyResponseRecord[] = Array.from(
      { length: 3 },
      (_, index) => ({
        id: `response_locked_v5_${index}`,
        roundId: round.id,
        submittedAt: new Date(),
        answers: surveyInstrument.questions.map((question) => ({
          questionId: question.id,
          dimensionId: question.dimensionId,
          value: 'green' as AnswerValue,
          score: 100,
        })),
      }),
    );

    const result = AnalyticsService.calculateDynamicRoundAnalytics(
      round,
      responses,
    );

    assert.strictEqual(result.contractVersion, '5.0');
    assert.strictEqual(result.isLocked, true);
    assert.deepStrictEqual(result.questionAggregates, {});
    assert.deepStrictEqual(result.dimensionScores, {});
  } finally {
    if (previousVersion === undefined) {
      delete process.env.AI_ANALYTICS_CONTRACT_VERSION;
    } else {
      process.env.AI_ANALYTICS_CONTRACT_VERSION = previousVersion;
    }
  }
});

test('an unlocked 5.0 round carries a distribution for every question', () => {
  const previousVersion = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '5.0';

  try {
    const round = RoundService.createRound({
      organizationId: 'org_unlocked_v5',
      title: 'סבב פתוח',
      privacyThreshold: MINIMUM_PRIVACY_THRESHOLD,
      surveyDefinition: createCanonicalSurveyDefinition(
        'סבב פתוח',
        MINIMUM_PRIVACY_THRESHOLD,
      ),
    });
    // Ten answers: two red, three yellow, five green.
    const responses: SurveyResponseRecord[] = Array.from(
      { length: MINIMUM_PRIVACY_THRESHOLD },
      (_, index) => ({
        id: `response_unlocked_v5_${index}`,
        roundId: round.id,
        submittedAt: new Date(),
        answers: surveyInstrument.questions.map((question) => {
          const value: AnswerValue =
            index < 2 ? 'red' : index < 5 ? 'yellow' : 'green';
          return {
            questionId: question.id,
            dimensionId: question.dimensionId,
            value,
            score: value === 'green' ? 100 : value === 'yellow' ? 60 : 0,
          };
        }),
      }),
    );

    const result = AnalyticsService.calculateDynamicRoundAnalytics(
      round,
      responses,
    );

    assert.strictEqual(result.isLocked, false);
    for (const aggregate of Object.values(result.questionAggregates)) {
      assert.deepStrictEqual(aggregate.scoreDistribution, {
        green: 5,
        yellow: 3,
        red: 2,
      });
      assert.strictEqual(aggregate.responseCount, MINIMUM_PRIVACY_THRESHOLD);
    }
  } finally {
    if (previousVersion === undefined) {
      delete process.env.AI_ANALYTICS_CONTRACT_VERSION;
    } else {
      process.env.AI_ANALYTICS_CONTRACT_VERSION = previousVersion;
    }
  }
});
