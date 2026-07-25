import assert from 'node:assert';
import test from 'node:test';
import { surveyInstrument } from '../../shalomut-source';
import type {
  AnswerValue,
  SurveyResponseRecord,
} from '../../types/backend';
import { AnalyticsService } from '../analytics.service';

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
