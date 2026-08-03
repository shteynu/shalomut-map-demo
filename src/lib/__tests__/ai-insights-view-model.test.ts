import assert from 'node:assert';
import test from 'node:test';
import type { StoneDetail, StoneDetailV6 } from '../ai-contract';
import { toDashboardStone } from '../ai-insights-view-model';

test('a stone becomes the dashboard shape the screens render', () => {
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

  const result = toDashboardStone(stone);

  assert.strictEqual(result.status, 'red');
  assert.strictEqual(result.score, 40);
  assert.deepStrictEqual(result.summary, ['נדרש שינוי בעומס העבודה.']);
  assert.strictEqual(result.metrics[0].value, '40.0');
  assert.match(result.recommendations[0].body, /שני חלונות/);
});

test('Contract V6 maps three summary paragraphs and qualitative metrics', () => {
  const stone: StoneDetailV6 = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'yellow',
    score: 62,
    summary: ['פסקה ראשונה.', 'פסקה שנייה.', 'פסקה שלישית.'],
    metrics: [
      {
        label: 'עומס משימות',
        value: '62 מתוך 100',
        questionId: 'balance-q1',
        averageScore: 62,
        responseCount: 20,
        scoreDistribution: { green: 4, yellow: 12, red: 4 },
        insightText: 'הצוות מתאר עומס משתנה שמצריך תשומת לב משותפת.',
      },
    ],
    recommendedInterventions: [] as unknown as StoneDetailV6['recommendedInterventions'],
    generationProvenance: {
      outcome: 'llm',
      attempts: 1,
      retryCount: 0,
      sourceQuestionIds: ['balance-q1'],
    },
  };

  const result = toDashboardStone(stone);

  assert.deepStrictEqual(result.summary, stone.summary);
  assert.deepStrictEqual(result.metrics[0], {
    label: 'עומס משימות',
    value: '',
    helper: '',
    highlightText: stone.metrics[0].insightText,
    narrativeOnly: true,
  });
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
  const result = toDashboardStone(
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
  // The whole string, not three separate matches: the order is the thing that
  // has to hold. High, middle, low is how the bar beside it is drawn, and in
  // RTL that is how it is read from the right. Asserting the parts one by one
  // is what let the sentence lead with the middle for as long as it did.
  assert.strictEqual(
    result.metrics[0].helper,
    '20 משיבים · 4 גבוה · 12 באמצע · 4 נמוך',
  );
});

test('a question below the threshold keeps the count and loses the split', () => {
  // Three answers as three counts is close to a list of who said what.
  const result = toDashboardStone(
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
  const result = toDashboardStone(
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

  const result = toDashboardStone(stone);

  assert.deepStrictEqual(result.summary, []);
  assert.strictEqual(result.interpretationUnavailable, true);
  // The numbers are real even where the paragraph is missing.
  assert.strictEqual(result.score, 41);
  assert.strictEqual(result.status, 'red');
});

test('a stone the model wrote is not marked unavailable', () => {
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

  const result = toDashboardStone(stone);

  assert.strictEqual(result.interpretationUnavailable, false);
  assert.deepStrictEqual(result.summary, ['נדרש שינוי בעומס העבודה.']);
});
