import assert from 'node:assert';
import test from 'node:test';
import {
  AI_ANALYTICS_DIMENSION_IDS,
  type StoneDetail,
  type StoneDetailV6,
  type StoneMapResult,
} from '../ai-contract';
import {
  toDashboardInsights,
  toDashboardStone,
} from '../ai-insights-view-model';
import type { WellbeingDimensionId } from '../shalomut-source';

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
  assert.strictEqual(result.recommendations[0].source, 'OECD');
});

test('a recommendation keeps the source the payload gave it', () => {
  const cited = 'ISO 45003:2021, סעיף 6.1.2.1 — עומס וקצב עבודה';
  const stone: StoneDetail = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'red',
    score: 40,
    psychologicalInterpretation: 'נדרש שינוי בעומס העבודה.',
    metrics: [],
    recommendedInterventions: [
      {
        id: 'balance-1',
        dimensionId: 'balance',
        source: `  ${cited}  `,
        title: 'חלונות זמן מוגנים',
        summary: 'להגן על זמן הכנה.',
        actionable_steps: [],
      },
      {
        id: 'balance-2',
        dimensionId: 'balance',
        source: '   ',
        title: 'ישיבה קצרה',
        summary: 'לקצר את הישיבה השבועית.',
        actionable_steps: [],
      },
    ],
  };

  const [withSource, withoutSource] = toDashboardStone(stone).recommendations;

  // Trimmed, because the screen prints it verbatim after a colon.
  assert.strictEqual(withSource.source, cited);
  // Whitespace is not an attribution, and the screen must show nothing rather
  // than an empty citation line.
  assert.strictEqual(withoutSource.source, '');
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

test('a red dimension the service wrote itself says so', () => {
  // Contract 6.0 has no `unavailable` for a dimension: a silent provider
  // produces aggregate-derived copy and a `success` round. Without this flag
  // the screen cannot tell that apart from an analysis the model wrote, which
  // is the one distinction a manager reading a red stone needs.
  const result = toDashboardStone(
    v6Stone({
      status: 'red',
      score: 28,
      generationProvenance: {
        outcome: 'deterministic_fallback',
        attempts: 3,
        retryCount: 2,
        sourceQuestionIds: ['management-support-q1'],
      },
    }),
  );

  assert.strictEqual(result.summaryIsDeterministic, true);
  // The paragraphs are still shown: they are derived from the aggregates and
  // assert nothing beyond them. Only the claim of authorship changes.
  assert.strictEqual(result.summary.length, 3);
  assert.strictEqual(result.interpretationUnavailable, false);
});

test('a stone the model wrote is not marked deterministic', () => {
  const result = toDashboardStone(v6Stone());

  assert.strictEqual(result.summaryIsDeterministic, false);
});

test('the insights DTO names the gaps in canonical order', () => {
  const gapped = (dimensionId: WellbeingDimensionId) =>
    v6Stone({
      dimensionId,
      summary: [],
      generationProvenance: {
        outcome: 'unavailable',
        attempts: 4,
        retryCount: 3,
        sourceQuestionIds: [`${dimensionId}-q1`],
      },
    });

  const result = toDashboardInsights({
    contractVersion: '6.0',
    roundId: 'round-partial',
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary: 'סיכום ארגוני.',
    stones: {
      ...Object.fromEntries(
        AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => [
          dimensionId,
          v6Stone({
            dimensionId,
            generationProvenance: {
              outcome: 'llm',
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: [`${dimensionId}-q1`],
            },
          }),
        ]),
      ),
      balance: gapped('balance'),
      certainty: gapped('certainty'),
    } as StoneMapResult['stones'],
  });

  // Canonical order, not the order the stones happened to be walked in: the
  // banner names them in the same order the map does.
  assert.deepStrictEqual(result.dimensionsWithoutInterpretation, [
    'balance',
    'certainty',
  ]);
});

test('a whole map names no gaps at all', () => {
  const result = toDashboardInsights({
    contractVersion: '6.0',
    roundId: 'round-whole',
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary: 'סיכום ארגוני.',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => [
        dimensionId,
        v6Stone({
          dimensionId,
          generationProvenance: {
            outcome: 'llm',
            attempts: 1,
            retryCount: 0,
            sourceQuestionIds: [`${dimensionId}-q1`],
          },
        }),
      ]),
    ) as StoneMapResult['stones'],
  });

  assert.deepStrictEqual(result.dimensionsWithoutInterpretation, []);
});

test('a V6 gap reaches the screen as missing, not as three empty paragraphs', () => {
  const result = toDashboardStone(
    v6Stone({
      summary: [],
      generationProvenance: {
        outcome: 'unavailable',
        attempts: 4,
        retryCount: 3,
        sourceQuestionIds: ['management-support-q1'],
      },
    }),
  );

  assert.deepStrictEqual(result.summary, []);
  assert.strictEqual(result.interpretationUnavailable, true);
  // A gap is not fallback copy, so it must not also claim the service wrote
  // something.
  assert.strictEqual(result.summaryIsDeterministic, false);
});

function v6Stone(overrides: Partial<StoneDetailV6> = {}): StoneDetailV6 {
  return {
    dimensionId: 'management-support',
    dimensionNameHebrew: 'תמיכת הנהלה',
    status: 'yellow',
    score: 55,
    summary: ['פסקה ראשונה.', 'פסקה שנייה.', 'פסקה שלישית.'],
    metrics: [],
    recommendedInterventions:
      [] as unknown as StoneDetailV6['recommendedInterventions'],
    generationProvenance: {
      outcome: 'llm',
      attempts: 1,
      retryCount: 0,
      sourceQuestionIds: ['management-support-q1'],
    },
    ...overrides,
  };
}

test('the metric narratives carry their own provenance, not the summary’s', () => {
  // The case the summary outcome cannot express: the model wrote the three
  // paragraphs and the narrative call fell back, so a manager reading a real
  // interpretation would have no reason to suspect the readings under it.
  const mixed = toDashboardStone(
    v6Stone({
      generationProvenance: {
        outcome: 'llm',
        metricInsightsOutcome: 'deterministic_fallback',
        attempts: 1,
        retryCount: 0,
        sourceQuestionIds: ['management-support-q1'],
      },
    }),
  );

  assert.strictEqual(mixed.summaryIsDeterministic, false);
  assert.strictEqual(mixed.metricNarrativesAreDeterministic, true);

  const written = toDashboardStone(
    v6Stone({
      generationProvenance: {
        outcome: 'deterministic_fallback',
        metricInsightsOutcome: 'llm',
        attempts: 2,
        retryCount: 1,
        sourceQuestionIds: ['management-support-q1'],
      },
    }),
  );

  assert.strictEqual(written.summaryIsDeterministic, true);
  assert.strictEqual(written.metricNarrativesAreDeterministic, false);

  // A round analysed before the field existed claims nothing either way, and
  // the screen adds no note rather than asserting a model wrote them.
  assert.strictEqual(
    toDashboardStone(v6Stone()).metricNarrativesAreDeterministic,
    false,
  );
});
