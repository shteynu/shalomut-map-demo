import assert from 'node:assert';
import test from 'node:test';
import {
  AI_ANALYTICS_CONTRACT_VERSION,
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  validateStoneMapResult,
} from '../ai-contract';
import { surveyInstrument } from '../shalomut-source';

function createSemanticallyValidPayload() {
  return {
    contractVersion: AI_ANALYTICS_CONTRACT_VERSION,
    roundId: 'round-semantic-contract',
    processedAt: '2026-07-25T12:00:00.000Z',
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary:
      'הסיכום מציג את דפוסי המענה המצרפיים. הנתונים נשמרים מעל סף הפרטיות בלבד.',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => {
        const dimension = surveyInstrument.dimensions.find(
          (candidate) => candidate.id === dimensionId,
        );
        assert.ok(dimension);

        return [
          dimensionId,
          {
            dimensionId,
            dimensionNameHebrew:
              AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId],
            status: 'yellow',
            score: 60,
            psychologicalInterpretation:
              'ממוצעי השאלות מצביעים על מצב הדורש תשומת לב. הפירוט נשען על נתונים מצרפיים בלבד.',
            recommendedInterventions: [],
            metrics: dimension.questions.map((question) => ({
              questionId: question.id,
              label: question.text,
              value: '60 מתוך 100',
              averageScore: 60,
              responseCount: 12,
            })),
            generationProvenance: {
              outcome: 'llm',
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: dimension.questions.map(
                (question) => question.id,
              ),
            },
          },
        ];
      }),
    ),
  };
}

test('validateStoneMapResult accepts the complete 2.0 semantic contract', () => {
  const result = validate(createSemanticallyValidPayload());

  assert.strictEqual(result.ok, true);
});

function validate(payload: unknown) {
  return validateStoneMapResult(payload, 'round-semantic-contract');
}

test('validateStoneMapResult rejects Latin user-facing interpretation copy', () => {
  const payload = createSemanticallyValidPayload();
  payload.stones.balance.psychologicalInterpretation =
    'Workload remains high. The team needs immediate support.';

  const result = validate(payload);

  assert.strictEqual(result.ok, false);
});

test('validateStoneMapResult rejects an incomplete dimension interpretation', () => {
  const payload = createSemanticallyValidPayload();
  payload.stones.balance.psychologicalInterpretation =
    'הנתונים מצביעים על קושי מתמשך ללא משפט שני';

  const result = validate(payload);

  assert.strictEqual(result.ok, false);
});

test('validateStoneMapResult rejects status inconsistent with the numerical score', () => {
  const payload = createSemanticallyValidPayload();
  payload.stones.balance.status = 'green';
  payload.stones.balance.score = 20;

  const result = validate(payload);

  assert.strictEqual(result.ok, false);
});

test('validateStoneMapResult rejects generic metrics without canonical question identity', () => {
  const payload = createSemanticallyValidPayload();
  payload.stones.balance.metrics = [
    {
      questionId: 'generic-score',
      label: 'ציון ממוצע',
      value: '60.0',
      averageScore: 60,
      responseCount: 12,
    },
    {
      questionId: 'generic-status',
      label: 'סטטוס מחוון',
      value: 'צהוב',
      averageScore: 60,
      responseCount: 12,
    },
    {
      questionId: 'generic-risk',
      label: 'רמת סיכון',
      value: 'בינונית',
      averageScore: 60,
      responseCount: 12,
    },
  ];

  const result = validate(payload);

  assert.strictEqual(result.ok, false);
});

test('validateStoneMapResult rejects an incomplete canonical question metric set', () => {
  const payload = createSemanticallyValidPayload();
  payload.stones.balance.metrics = payload.stones.balance.metrics.slice(0, 2);

  const result = validate(payload);

  assert.strictEqual(result.ok, false);
});

test('validateStoneMapResult accepts 3.0 stones with dynamic custom metrics and variable counts', () => {
  const surveyDefinitionHash =
    'sha256:4fdff8a264c71ad6433b21971268e0c9c78077d1a5894479f9132ae02dd82bd4';
  const stones = Object.fromEntries(
    AI_ANALYTICS_DIMENSION_IDS.map((dimensionId, dimensionIndex) => {
      const metricCount = dimensionId === 'balance' ? 2 : 1;
      const metrics = Array.from({ length: metricCount }, (_, metricIndex) => ({
        questionId: `round-custom-${dimensionId}-${metricIndex + 1}`,
        label: `שאלה מותאמת לממד ${dimensionIndex + 1} פריט ${metricIndex + 1}`,
        value: 'שישים מתוך מאה',
        averageScore: 60,
        responseCount: 12,
      }));

      return [
        dimensionId,
        {
          dimensionId,
          dimensionNameHebrew:
            AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId],
          status: 'yellow',
          score: 60,
          psychologicalInterpretation:
            'ממוצעי השאלות מצביעים על מצב שדורש תשומת לב. הפירוט נשען על השאלות המותאמות של הסבב.',
          recommendedInterventions: [],
          metrics,
          generationProvenance: {
            outcome: 'llm',
            attempts: 1,
            retryCount: 0,
            sourceQuestionIds: metrics.map((metric) => metric.questionId),
            surveyDefinitionHash,
          },
        },
      ];
    }),
  );
  const payload = {
    contractVersion: '3.0',
    roundId: 'round-semantic-contract',
    processedAt: '2026-07-26T12:00:00.000Z',
    isLocked: false,
    status: 'success',
    surveyDefinitionHash,
    overallPsychologicalSummary:
      'הסיכום מציג דפוסים מצרפיים. הנתונים נשמרים מעל סף הפרטיות.',
    stones,
  };

  const result = validate(payload);

  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.stones?.balance.metrics.length, 2);
    assert.strictEqual(result.value.stones?.meaning.metrics.length, 1);
    assert.strictEqual(
      result.value.stones?.balance.metrics[0].label,
      stones.balance.metrics[0].label,
    );
  }
});

test('validateStoneMapResult rejects 3.0 provenance that does not match its dynamic metrics', () => {
  const surveyDefinitionHash = `sha256:${'c'.repeat(64)}`;
  const payload = {
    contractVersion: '3.0',
    roundId: 'round-semantic-contract',
    processedAt: '2026-07-26T12:00:00.000Z',
    isLocked: false,
    status: 'success',
    surveyDefinitionHash,
    overallPsychologicalSummary:
      'הסיכום מציג דפוסים מצרפיים. הנתונים נשמרים מעל סף הפרטיות.',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => [
        dimensionId,
        {
          dimensionId,
          dimensionNameHebrew:
            AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId],
          status: 'yellow',
          score: 60,
          psychologicalInterpretation:
            'ניתוח השאלה מצביע על מצב שדורש תשומת לב. הפירוט נשען על נתון מצרפי בלבד.',
          recommendedInterventions: [],
          metrics: [
            {
              questionId: `custom-${dimensionId}`,
              label: 'שאלה מותאמת לסבב',
              value: 'שישים מתוך מאה',
              averageScore: 60,
              responseCount: 12,
            },
          ],
          generationProvenance: {
            outcome: 'llm',
            attempts: 1,
            retryCount: 0,
            sourceQuestionIds: [`wrong-${dimensionId}`],
            surveyDefinitionHash,
          },
        },
      ]),
    ),
  };

  assert.strictEqual(validate(payload).ok, false);
});

test('validateStoneMapResult rejects 3.0 provenance from a different questionnaire snapshot', () => {
  const surveyDefinitionHash = `sha256:${'d'.repeat(64)}`;
  const payload = {
    contractVersion: '3.0',
    roundId: 'round-semantic-contract',
    processedAt: '2026-07-26T12:00:00.000Z',
    isLocked: false,
    status: 'success',
    surveyDefinitionHash,
    overallPsychologicalSummary:
      'הסיכום מציג דפוסים מצרפיים. הנתונים נשמרים מעל סף הפרטיות.',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => [
        dimensionId,
        {
          dimensionId,
          dimensionNameHebrew:
            AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId],
          status: 'yellow',
          score: 60,
          psychologicalInterpretation:
            'ניתוח השאלה מצביע על מצב שדורש תשומת לב. הפירוט נשען על נתון מצרפי בלבד.',
          recommendedInterventions: [],
          metrics: [
            {
              questionId: `custom-${dimensionId}`,
              label: 'שאלה מותאמת לסבב',
              value: 'שישים מתוך מאה',
              averageScore: 60,
              responseCount: 12,
            },
          ],
          generationProvenance: {
            outcome: 'deterministic_fallback',
            attempts: 0,
            retryCount: 0,
            sourceQuestionIds: [`custom-${dimensionId}`],
            surveyDefinitionHash: `sha256:${'e'.repeat(64)}`,
          },
        },
      ]),
    ),
  };

  assert.strictEqual(validate(payload).ok, false);
});
