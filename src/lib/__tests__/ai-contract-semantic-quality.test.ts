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
          },
        ];
      }),
    ),
  };
}

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
