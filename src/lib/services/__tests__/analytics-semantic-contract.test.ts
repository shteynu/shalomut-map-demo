import assert from 'node:assert';
import test from 'node:test';
import { InMemoryRoundRepository } from '../../repositories/in-memory/in-memory-round.repository';
import { InMemorySurveyRepository } from '../../repositories/in-memory/in-memory-survey.repository';
import { surveyInstrument } from '../../shalomut-source';
import type {
  AnswerValue,
  SurveyDefinition,
  SurveyDefinitionQuestion,
  SurveyResponseRecord,
  SurveyRound,
} from '../../types/backend';
import { AnalyticsService } from '../analytics.service';
import { createSurveyDefinitionHash } from '../../survey-definition-hash';

type QuestionAggregate = {
  questionId: string;
  dimensionId: string;
  questionTextHebrew: string;
  averageScore: number;
  responseCount: number;
};

type AnalyticsWithQuestionAggregates = {
  questionAggregates?: Record<string, QuestionAggregate>;
};

function createResponses(roundId: string, count: number): SurveyResponseRecord[] {
  const values: AnswerValue[] = ['green', 'yellow', 'red'];

  return Array.from({ length: count }, (_, responseIndex) => ({
    id: `response_${responseIndex}`,
    roundId,
    submittedAt: new Date('2026-07-25T12:00:00.000Z'),
    answers: surveyInstrument.questions.map((question, questionIndex) => {
      const value = values[questionIndex % values.length];
      const score = value === 'green' ? 100 : value === 'yellow' ? 60 : 0;

      return {
        questionId: question.id,
        dimensionId: question.dimensionId,
        value,
        score,
      };
    }),
  }));
}

function createDefinition(
  questions: SurveyDefinitionQuestion[],
): SurveyDefinition {
  return {
    title: 'שאלון סבבי',
    audience: 'צוות ההוראה',
    estimatedMinutes: 10,
    minimumResponses: 10,
    introText: 'נשמח למענה כן ומכבד.',
    anonymityText: 'התוצאות מוצגות באופן מצרפי בלבד.',
    questions,
  };
}

function createRound(
  id: string,
  organizationId: string,
  surveyDefinition: SurveyDefinition,
): SurveyRound {
  return {
    id,
    organizationId,
    title: surveyDefinition.title,
    status: 'closed',
    shareCode: id.toUpperCase(),
    privacyThreshold: 10,
    startDate: new Date('2026-07-26T12:00:00.000Z'),
    surveyDefinition,
    createdAt: new Date('2026-07-26T12:00:00.000Z'),
  };
}

function createDefinitionResponses(
  roundId: string,
  questions: SurveyDefinitionQuestion[],
  count = 10,
): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, responseIndex) => ({
    id: `${roundId}_response_${responseIndex}`,
    roundId,
    submittedAt: new Date('2026-07-26T12:00:00.000Z'),
    answers: questions.map((question, questionIndex) => {
      const score = questionIndex % 3 === 0 ? 100 : questionIndex % 3 === 1 ? 60 : 0;
      const value = score === 100 ? 'green' : score === 60 ? 'yellow' : 'red';

      return {
        questionId: question.id,
        dimensionId: question.dimensionId,
        value,
        score,
      };
    }),
  }));
}

type DynamicAnalyticsResult = {
  contractVersion: string;
  organizationId: string;
  surveyDefinitionHash: string;
  isLocked: boolean;
  questionAggregates: Record<
    string,
    {
      questionId: string;
      dimensionId: string;
      questionText: string;
      averageScore: number;
      responseCount: number;
    }
  >;
};

test('AnalyticsService exposes exactly 24 canonical question aggregates after the privacy threshold', () => {
  const roundId = 'round_semantic_unlocked';
  const result = AnalyticsService.calculateRoundAnalytics(
    roundId,
    10,
    createResponses(roundId, 10),
  );
  const questionAggregates = (
    result as typeof result & AnalyticsWithQuestionAggregates
  ).questionAggregates;

  assert.strictEqual(result.contractVersion, '2.0');
  assert.ok(
    questionAggregates,
    'unlocked analytics must expose canonical questionAggregates',
  );
  assert.deepStrictEqual(
    Object.keys(questionAggregates).sort(),
    surveyInstrument.questions.map((question) => question.id).sort(),
  );

  const firstDimensionQuestions = surveyInstrument.dimensions[0].questions;
  assert.deepStrictEqual(
    firstDimensionQuestions.map(
      (question) => questionAggregates[question.id].averageScore,
    ),
    [100, 60, 0],
  );

  for (const question of surveyInstrument.questions) {
    assert.deepStrictEqual(questionAggregates[question.id], {
      questionId: question.id,
      dimensionId: question.dimensionId,
      questionTextHebrew: question.text,
      averageScore: questionAggregates[question.id].averageScore,
      responseCount: 10,
    });
  }
});

test('AnalyticsService keeps round data isolated and dimension status consistent with its score', () => {
  const roundId = 'round_semantic_isolated';
  const result = AnalyticsService.calculateRoundAnalytics(roundId, 10, [
    ...createResponses(roundId, 10),
    ...createResponses('round_from_another_organization', 10),
  ]);

  assert.strictEqual(result.totalResponses, 10);
  assert.strictEqual(result.questionAggregates['self-expression-1'].responseCount, 10);

  for (const dimension of surveyInstrument.dimensions) {
    const dimensionScore = result.dimensionScores[dimension.id];
    assert.strictEqual(
      dimensionScore.computedStatus,
      AnalyticsService.computeStatus(dimensionScore.averageScore),
    );
  }
});

test('AnalyticsService exposes no detailed aggregates below the privacy threshold', () => {
  const result = AnalyticsService.calculateRoundAnalytics(
    'round_semantic_locked',
    10,
    createResponses('round_semantic_locked', 9),
  );
  const questionAggregates = (
    result as typeof result & AnalyticsWithQuestionAggregates
  ).questionAggregates;

  assert.deepStrictEqual(
    result.dimensionScores,
    {},
    'locked analytics must not expose placeholder dimension scores',
  );
  assert.deepStrictEqual(
    questionAggregates,
    {},
    'locked analytics must expose an explicit empty question aggregate map',
  );
});

test('AnalyticsService fails closed when any canonical question has fewer answers than the privacy threshold', () => {
  const roundId = 'round_semantic_incomplete';
  const responses = createResponses(roundId, 10);
  responses[0].answers = responses[0].answers.filter(
    (answer) => answer.questionId !== 'balance-2',
  );

  const result = AnalyticsService.calculateRoundAnalytics(
    roundId,
    10,
    responses,
  );

  assert.strictEqual(result.totalResponses, 10);
  assert.strictEqual(result.isLocked, true);
  assert.deepStrictEqual(result.dimensionScores, {});
  assert.deepStrictEqual(result.questionAggregates, {});
});

test('AnalyticsService uses the exact persisted questionnaire for a round with eight custom question IDs', async () => {
  const roundId = 'round_dynamic_eight';
  const questions: SurveyDefinitionQuestion[] = surveyInstrument.dimensions.map(
    (dimension, index) => ({
      id: `custom-${dimension.id}-${index + 1}`,
      dimensionId: dimension.id,
      text: `שאלה מותאמת לסבב ${index + 1}`,
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    }),
  );
  const definition = createDefinition(questions);
  const result = await AnalyticsService.getAnalyticsForRound(
    roundId,
    new InMemoryRoundRepository([
      createRound(roundId, 'org_dynamic_a', definition),
    ]),
    new InMemorySurveyRepository(
      createDefinitionResponses(roundId, questions),
    ),
  );

  assert.ok(result);
  const dynamicResult = result as unknown as DynamicAnalyticsResult;
  assert.strictEqual(dynamicResult.contractVersion, '3.0');
  assert.strictEqual(dynamicResult.organizationId, 'org_dynamic_a');
  assert.strictEqual(
    dynamicResult.surveyDefinitionHash,
    createSurveyDefinitionHash(questions),
  );
  assert.strictEqual(dynamicResult.isLocked, false);
  assert.deepStrictEqual(
    Object.keys(dynamicResult.questionAggregates),
    questions.map((question) => question.id),
  );
  for (const question of questions) {
    assert.strictEqual(
      dynamicResult.questionAggregates[question.id].questionText,
      question.text,
    );
  }
});

test('AnalyticsService preserves revised persisted text and includes a supplemental question in a different round', async () => {
  const roundId = 'round_dynamic_twenty_five';
  const revisedText =
    'בסבב הזה אני מצליחה לבטא רעיונות בחופשיות ובביטחון.';
  const supplementalText =
    'יש לי זמן קבוע להתאוששות במהלך שבוע העבודה.';
  const questions: SurveyDefinitionQuestion[] = [
    ...surveyInstrument.questions.map((question, index) => ({
      id: question.id,
      dimensionId: question.dimensionId,
      text: index === 0 ? revisedText : question.text,
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    })),
    {
      id: 'balance-round-specific-recovery',
      dimensionId: 'balance',
      text: supplementalText,
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    },
  ];
  const definition = createDefinition(questions);
  const result = await AnalyticsService.getAnalyticsForRound(
    roundId,
    new InMemoryRoundRepository([
      createRound(roundId, 'org_dynamic_b', definition),
    ]),
    new InMemorySurveyRepository(
      createDefinitionResponses(roundId, questions),
    ),
  );

  assert.ok(result);
  const dynamicResult = result as unknown as DynamicAnalyticsResult;
  assert.strictEqual(dynamicResult.contractVersion, '3.0');
  assert.strictEqual(
    Object.keys(dynamicResult.questionAggregates).length,
    questions.length,
  );
  assert.strictEqual(
    dynamicResult.questionAggregates['self-expression-1'].questionText,
    revisedText,
  );
  assert.strictEqual(
    dynamicResult.questionAggregates['balance-round-specific-recovery']
      .questionText,
    supplementalText,
  );
});

test('AnalyticsService locks all dynamic details when one enabled question is below threshold', async () => {
  const roundId = 'round_dynamic_partial_privacy';
  const questions: SurveyDefinitionQuestion[] = surveyInstrument.dimensions.map(
    (dimension, index) => ({
      id: `privacy-${dimension.id}-${index + 1}`,
      dimensionId: dimension.id,
      text: `שאלת פרטיות ${index + 1}`,
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    }),
  );
  const responses = createDefinitionResponses(roundId, questions);
  responses[0].answers = responses[0].answers.filter(
    (answer) => answer.questionId !== questions[0].id,
  );

  const result = await AnalyticsService.getAnalyticsForRound(
    roundId,
    new InMemoryRoundRepository([
      createRound(roundId, 'org_dynamic_private', createDefinition(questions)),
    ]),
    new InMemorySurveyRepository(responses),
  );

  assert.ok(result);
  assert.strictEqual(result.contractVersion, '3.0');
  assert.strictEqual(result.totalResponses, 10);
  assert.strictEqual(result.isLocked, true);
  assert.deepStrictEqual(result.dimensionScores, {});
  assert.deepStrictEqual(result.questionAggregates, {});
});

test('AnalyticsService excludes disabled questions from dynamic aggregates and hash', async () => {
  const roundId = 'round_dynamic_disabled';
  const enabledQuestions: SurveyDefinitionQuestion[] = surveyInstrument.dimensions.map(
    (dimension, index) => ({
      id: `enabled-${dimension.id}-${index + 1}`,
      dimensionId: dimension.id,
      text: `שאלה פעילה ${index + 1}`,
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    }),
  );
  const disabledQuestion: SurveyDefinitionQuestion = {
    ...enabledQuestions[0],
    id: 'disabled-supplemental',
    text: 'שאלה לא פעילה',
    enabled: false,
  };
  const definition = createDefinition([...enabledQuestions, disabledQuestion]);
  const result = await AnalyticsService.getAnalyticsForRound(
    roundId,
    new InMemoryRoundRepository([
      createRound(roundId, 'org_dynamic_disabled', definition),
    ]),
    new InMemorySurveyRepository(
      createDefinitionResponses(roundId, enabledQuestions),
    ),
  );

  assert.ok(result);
  assert.strictEqual(result.isLocked, false);
  assert.deepStrictEqual(
    Object.keys(result.questionAggregates),
    enabledQuestions.map((question) => question.id),
  );
  assert.strictEqual(
    result.surveyDefinitionHash,
    createSurveyDefinitionHash(enabledQuestions),
  );
});
