import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  AI_ANALYTICS_V5_CONTRACT_VERSION,
  isValidScoreDistribution,
  validateStoneMapResult,
} from '../ai-contract';

function createValidV5Payload() {
  return {
    contractVersion: '5.0',
    roundId: 'round-v5-test',
    status: 'success',
    isLocked: false,
    processedAt: '2026-07-27T12:00:00.000Z',
    surveyDefinitionHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    overallPsychologicalSummary: 'הסקר מציג תמונה מקיפה של בית הספר. המדים השונים מראים שונות רבה.',
    stones: {
      'self-expression': createValidStone('self-expression'),
      'professional-competence': createValidStone('professional-competence'),
      'social-resource': createValidStone('social-resource'),
      balance: createValidStone('balance'),
      'management-support': createValidStone('management-support'),
      certainty: createValidStone('certainty'),
      'organizational-climate': createValidStone('organizational-climate'),
      meaning: createValidStone('meaning'),
    },
  };
}

function createValidStone(dimensionId: string) {
  const nameMap: Record<string, string> = {
    'self-expression': 'ביטוי עצמי',
    'professional-competence': 'מסוגלות מקצועית',
    'social-resource': 'קשרים חברתיים',
    balance: 'איזון',
    'management-support': 'עורף מקצועי',
    certainty: 'ודאות',
    'organizational-climate': 'אקלים ארגוני',
    meaning: 'משמעות',
  };

  return {
    dimensionId,
    dimensionNameHebrew: nameMap[dimensionId],
    status: 'green',
    score: 80,
    psychologicalInterpretation: 'תחושת הביטחון של צוות ההוראה גבוהה במיוחד. התקשורת הפתוחה בין המורים תורמת לתחושת השייכות והצמיחה.',
    recommendedInterventions: [
      {
        id: 'int-1',
        dimensionId,
        status: 'green',
        source: 'OECD',
        title: 'שימור תקשורת פתוחה',
        summary: 'חיזוק מעגלי שיח בצוות',
        actionable_steps: ['מפגש שבועי לקבוצות קטנות'],
      },
    ],
    metrics: [
      {
        questionId: `q-${dimensionId}-1`,
        label: 'שאלה לדוגמה בעברית',
        value: 'תוצאה טובה בעברית',
        averageScore: 80,
        responseCount: 20,
      },
    ],
    generationProvenance: {
      outcome: 'llm',
      attempts: 1,
      retryCount: 0,
      sourceQuestionIds: [`q-${dimensionId}-1`],
      surveyDefinitionHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      backgroundContextIncluded: true,
      distributionIncluded: true,
      crossDimensionContextIncluded: true,
    },
  };
}

describe('Contract 5.0 Validation Tests', () => {
  test('isValidScoreDistribution validates exact sum matching responseCount', () => {
    assert.strictEqual(
      isValidScoreDistribution({ green: 10, yellow: 5, red: 5 }, 20),
      true,
    );
    assert.strictEqual(
      isValidScoreDistribution({ green: 10, yellow: 5, red: 4 }, 20),
      false,
    );
    assert.strictEqual(
      isValidScoreDistribution({ green: -1, yellow: 10, red: 11 }, 20),
      false,
    );
  });

  test('validateStoneMapResult accepts valid 5.0 payload', () => {
    const payload = createValidV5Payload();
    const result = validateStoneMapResult(payload, 'round-v5-test');
    if (!result.ok) {
      console.error('Validation error:', result.error);
    }
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.contractVersion, AI_ANALYTICS_V5_CONTRACT_VERSION);
    }
  });

  test('validateStoneMapResult accepts 3-sentence psychological interpretation in 5.0', () => {
    const payload = createValidV5Payload();
    payload.stones['balance'].psychologicalInterpretation =
      'תחושת האיזון נמצאת במגמת שיפור. המורים מדווחים על עומס מסוים בסוף השבוע. מומלץ לבחון את חלוקת המשימות הארגונית.';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, true);
  });

  test('validateStoneMapResult rejects 6-sentence psychological interpretation in 5.0', () => {
    const payload = createValidV5Payload();
    payload.stones['balance'].psychologicalInterpretation =
      'משפט ראשון בעברית. משפט שני בעברית. משפט שלישי בעברית. משפט רביעי בעברית. משפט חמישי בעברית. משפט שישי בעברית.';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('validateStoneMapResult rejects overall summary with 5 sentences in 5.0', () => {
    const payload = createValidV5Payload();
    payload.overallPsychologicalSummary =
      'משפט ראשון בעברית. משפט שני בעברית. משפט שלישי בעברית. משפט רביעי בעברית. משפט חמישי בעברית.';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('v4 payload continues to validate correctly without regression', () => {
    const payload = createValidV5Payload();
    payload.contractVersion = '4.0';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, true);
  });
});
