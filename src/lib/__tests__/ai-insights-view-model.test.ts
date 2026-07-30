import assert from 'node:assert';
import test from 'node:test';
import type { StoneDetail } from '../ai-contract';
import { applyStoneInsightToDimension } from '../ai-insights-view-model';
import { getDimensionById } from '../demo-data';

test('applyStoneInsightToDimension replaces demo analysis with AI content', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  const stone: StoneDetail = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'red',
    score: 40,
    psychologicalInterpretation: 'נדרש שינוי בעומס העבודה.',
    metrics: [{ label: 'ציון ממוצע', value: '40.0' }],
    recommendedInterventions: [
      {
        id: 'balance-1',
        dimensionId: 'balance',
        source: 'OECD',
        title: 'חלונות זמן מוגנים',
        summary: 'להגן על זמן הכנה.',
        actionable_steps: ['לקבוע שני חלונות בשבוע'],
      },
    ],
  };

  const result = applyStoneInsightToDimension(
    dimension,
    stone,
    'סיכום ארגוני',
  );

  assert.strictEqual(result.status, 'red');
  assert.strictEqual(result.score, 40);
  assert.deepStrictEqual(result.summary, ['נדרש שינוי בעומס העבודה.']);
  assert.strictEqual(result.metrics[0].value, '40.0');
  assert.match(result.recommendations[0].body, /שני חלונות/);
});

function stoneWithMetric(metric: StoneDetail['metrics'][number]): StoneDetail {
  return {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'yellow',
    score: 60,
    psychologicalInterpretation: 'הצוות מדווח על עומס בינוני.',
    metrics: [metric],
    recommendedInterventions: [],
  };
}

test('a question that cleared the threshold shows its split, in words and in a bar', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  const result = applyStoneInsightToDimension(
    dimension,
    stoneWithMetric({
      label: 'עומס משימות',
      value: '60.0',
      questionId: 'balance-q1',
      averageScore: 60,
      responseCount: 20,
      scoreDistribution: { green: 4, yellow: 12, red: 4 },
    }),
  );

  // Ten lukewarm answers and a staff split in half both average 60. The
  // counts are what tells them apart, so they belong in the sentence.
  assert.deepStrictEqual(result.metrics[0].distribution, {
    green: 4,
    yellow: 12,
    red: 4,
  });
  assert.match(result.metrics[0].helper, /20 משיבים/u);
  assert.match(result.metrics[0].helper, /12 באמצע/u);
  assert.match(result.metrics[0].helper, /4 גבוה/u);
  assert.match(result.metrics[0].helper, /4 נמוך/u);
});

test('a question below the threshold keeps the count and loses the split', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  // Three answers as three counts is close to a list of who said what.
  const result = applyStoneInsightToDimension(
    dimension,
    stoneWithMetric({
      label: 'עומס משימות',
      value: '60.0',
      questionId: 'balance-q1',
      averageScore: 60,
      responseCount: 3,
      scoreDistribution: { green: 1, yellow: 1, red: 1 },
    }),
  );

  assert.strictEqual(result.metrics[0].distribution, undefined);
  assert.match(result.metrics[0].helper, /3 משיבים/u);
  assert.doesNotMatch(result.metrics[0].helper, /באמצע/u);
});

test('a split that does not add up to the count is not drawn', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  const result = applyStoneInsightToDimension(
    dimension,
    stoneWithMetric({
      label: 'עומס משימות',
      value: '60.0',
      questionId: 'balance-q1',
      averageScore: 60,
      responseCount: 20,
      scoreDistribution: { green: 4, yellow: 4, red: 4 },
    }),
  );

  assert.strictEqual(result.metrics[0].distribution, undefined);
});

test('a stone the provider never wrote is marked, not merely left empty', () => {
  // An empty `summary` is also what a dimension looks like before any analysis
  // exists. The screens need to tell "not analysed yet" from "the round
  // finished and this paragraph could not be written", and they say different
  // things to the manager.
  const dimension = getDimensionById('certainty');
  assert.ok(dimension);

  const stone: StoneDetail = {
    dimensionId: 'certainty',
    dimensionNameHebrew: 'ודאות',
    status: 'red',
    score: 41,
    psychologicalInterpretation: '',
    metrics: [{ label: 'ציון ממוצע', value: '41.0' }],
    recommendedInterventions: [],
    generationProvenance: {
      outcome: 'unavailable',
      attempts: 2,
      retryCount: 1,
      sourceQuestionIds: ['q-certainty-1'],
    },
  };

  const result = applyStoneInsightToDimension(dimension, stone);

  assert.deepStrictEqual(result.summary, []);
  assert.strictEqual(result.interpretationUnavailable, true);
  // The numbers are real even where the paragraph is missing.
  assert.strictEqual(result.score, 41);
  assert.strictEqual(result.status, 'red');
});

test('a stone the model wrote is not marked unavailable', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  const stone: StoneDetail = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'red',
    score: 40,
    psychologicalInterpretation: 'נדרש שינוי בעומס העבודה.',
    metrics: [{ label: 'ציון ממוצע', value: '40.0' }],
    recommendedInterventions: [],
    generationProvenance: {
      outcome: 'llm',
      attempts: 1,
      retryCount: 0,
      sourceQuestionIds: ['q-balance-1'],
    },
  };

  const result = applyStoneInsightToDimension(dimension, stone);

  assert.strictEqual(result.interpretationUnavailable, false);
  assert.deepStrictEqual(result.summary, ['נדרש שינוי בעומס העבודה.']);
});
