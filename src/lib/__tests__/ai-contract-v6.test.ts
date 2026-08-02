import assert from 'node:assert';
import test from 'node:test';

import {
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  AI_ANALYTICS_V6_CONTRACT_VERSION,
  validateStoneMapResult,
} from '../ai-contract';

const SURVEY_DEFINITION_HASH = `sha256:${'a'.repeat(64)}`;

function narrative(seed: string): string {
  return `${seed} ${'הטקסט מתאר את המשמעות הרגשית והחברתית של התשובות ומציע התבוננות זהירה המבוססת רק על המידע שנאסף. '.repeat(4)}`.trim();
}

export function createValidV6Payload(roundId = 'round-v6') {
  return {
    contractVersion: AI_ANALYTICS_V6_CONTRACT_VERSION,
    roundId,
    processedAt: '2026-08-02T08:00:00.000Z',
    surveyDefinitionHash: SURVEY_DEFINITION_HASH,
    isLocked: false,
    status: 'success' as const,
    overallPsychologicalSummary:
      'התמונה הכללית מצביעה על שילוב של כוחות ושל אזורים הזקוקים לתשומת לב. מומלץ להתקדם באופן הדרגתי ולבדוק את השינוי יחד עם הצוות.',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId, dimensionIndex) => {
        const questionId = `question-${dimensionIndex + 1}`;
        return [
          dimensionId,
          {
            dimensionId,
            dimensionNameHebrew:
              AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId],
            status: 'yellow' as const,
            score: 62,
            summary: [
              'התשובות מצביעות על בסיס יציב לצד שונות מסוימת בין החוויות של המשתתפים.',
              'נראה כי חיזוק השיח המשותף יכול לעזור לצוות להבין טוב יותר את הצרכים שעולים מן הממצאים.',
              'כדאי לבחור צעד ממוקד אחד, ליישם אותו בעקביות ולבדוק בהמשך כיצד הוא משפיע על התחושה הכללית.',
            ],
            recommendedInterventions: Array.from({ length: 5 }, (_, index) => ({
              id: `${dimensionId}-intervention-${index + 1}`,
              dimensionId,
              status: 'yellow' as const,
              source: 'shalomut_catalog',
              title: 'מהלך צוותי ממוקד',
              summary: narrative('המהלך המוצע מחזק שגרה משותפת וברורה.'),
              actionable_steps: [
                'לקבוע זמן קבוע לשיחה קצרה עם הצוות.',
                'לאסוף משוב ולבחון את ההתקדמות יחד.',
              ],
              adaptationOutcome: 'llm' as const,
            })),
            metrics: [
              {
                questionId,
                label: 'עד כמה התחושה בתחום זה יציבה',
                value: 'מגמה בינונית',
                averageScore: 62,
                responseCount: 10,
                scoreDistribution: { green: 3, yellow: 5, red: 2 },
                insightText: narrative(
                  'התשובות מלמדות שהחוויה אינה אחידה ושיש מקום לחיזוק עקבי.',
                ),
              },
            ],
            generationProvenance: {
              outcome: 'llm' as const,
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: [questionId],
              surveyDefinitionHash: SURVEY_DEFINITION_HASH,
              backgroundContextIncluded: true,
              distributionIncluded: true,
              crossDimensionContextIncluded: true,
            },
          },
        ];
      }),
    ),
  };
}

test('accepts a complete Contract V6 Stone Map', () => {
  const payload = createValidV6Payload();
  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.strictEqual(AI_ANALYTICS_V6_CONTRACT_VERSION, '6.0');
  assert.deepStrictEqual(validation, { ok: true, value: payload });
});

test('requires exactly three dimension summary paragraphs', () => {
  const payload = createValidV6Payload();
  const dimensionId = AI_ANALYTICS_DIMENSION_IDS[0];
  payload.stones[dimensionId].summary.pop();

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.ok(!validation.ok);
  assert.match(validation.error, new RegExp(dimensionId, 'u'));
});

test('requires exactly five recommendations per dimension', () => {
  for (const [count, expected] of [
    [4, false],
    [5, true],
    [6, false],
  ] as const) {
    const payload = createValidV6Payload();
    const dimensionId = AI_ANALYTICS_DIMENSION_IDS[1];
    const interventions = payload.stones[dimensionId].recommendedInterventions;

    if (count === 4) interventions.pop();
    if (count === 6) {
      interventions.push({
        ...interventions[0],
        id: `${dimensionId}-intervention-6`,
      });
    }

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.strictEqual(validation.ok, expected, `count=${count}`);
  }
});

test('rejects duplicate recommendation IDs', () => {
  const payload = createValidV6Payload();
  const dimensionId = AI_ANALYTICS_DIMENSION_IDS[1];
  const interventions = payload.stones[dimensionId].recommendedInterventions;
  interventions[1].id = interventions[0].id;

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.ok(!validation.ok);
  assert.match(validation.error, new RegExp(dimensionId, 'u'));
});

test('enforces inclusive qualitative narrative length boundaries', () => {
  for (const [length, expected] of [
    [299, false],
    [300, true],
    [500, true],
    [501, false],
  ] as const) {
    const payload = createValidV6Payload();
    const dimensionId = AI_ANALYTICS_DIMENSION_IDS[2];
    payload.stones[dimensionId].metrics[0].insightText = 'א'.repeat(length);

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.strictEqual(validation.ok, expected, `length=${length}`);
  }
});

test('enforces score ranges and inclusive status boundaries', () => {
  const cases = [
    { score: -1, status: 'red', expected: false },
    { score: 0, status: 'red', expected: true },
    { score: 49, status: 'red', expected: true },
    { score: 50, status: 'yellow', expected: true },
    { score: 74, status: 'yellow', expected: true },
    { score: 75, status: 'green', expected: true },
    { score: 100, status: 'green', expected: true },
    { score: 101, status: 'green', expected: false },
    { score: Number.NaN, status: 'red', expected: false },
    { score: Number.POSITIVE_INFINITY, status: 'green', expected: false },
  ] as const;

  for (const { score, status, expected } of cases) {
    const payload = createValidV6Payload();
    const dimensionId = AI_ANALYTICS_DIMENSION_IDS[3];
    const stone = payload.stones[dimensionId] as {
      score: number;
      status: 'green' | 'yellow' | 'red';
      recommendedInterventions: Array<{
        status: 'green' | 'yellow' | 'red';
      }>;
    };
    stone.score = score;
    stone.status = status;
    stone.recommendedInterventions.forEach((intervention) => {
      intervention.status = status;
    });

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.strictEqual(validation.ok, expected, `score=${String(score)}`);
  }
});

test('rejects missing and extra canonical dimensions independently', () => {
  for (const mutation of ['missing', 'extra'] as const) {
    const payload = createValidV6Payload();
    const dimensionId = AI_ANALYTICS_DIMENSION_IDS[4];

    if (mutation === 'missing') {
      delete payload.stones[dimensionId];
    } else {
      payload.stones.unexpected = {
        ...payload.stones[dimensionId],
        dimensionId,
      };
    }

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.ok(!validation.ok, mutation);
    assert.match(validation.error, /canonical dimensions/i);
  }
});

test('rejects invalid generation attempt and retry counts', () => {
  const mutations = [
    { attempts: 0, retryCount: 0 },
    { attempts: 1, retryCount: -1 },
    { attempts: 1, retryCount: 1 },
  ];

  for (const provenanceMutation of mutations) {
    const payload = createValidV6Payload();
    const dimensionId = AI_ANALYTICS_DIMENSION_IDS[5];
    Object.assign(
      payload.stones[dimensionId].generationProvenance,
      provenanceMutation,
    );

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.ok(!validation.ok, JSON.stringify(provenanceMutation));
    assert.match(validation.error, new RegExp(dimensionId, 'u'));
  }
});

test('accepts zero attempts for deterministic fallback provenance', () => {
  const payload = createValidV6Payload();
  const dimensionId = AI_ANALYTICS_DIMENSION_IDS[5];
  Object.assign(payload.stones[dimensionId].generationProvenance, {
    outcome: 'deterministic_fallback' as const,
    attempts: 0,
    retryCount: 0,
  });

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.ok(validation.ok);
});

test('rejects missing, duplicate, and extra provenance question IDs', () => {
  for (const mutation of ['missing', 'duplicate', 'extra'] as const) {
    const payload = createValidV6Payload();
    const dimensionId = AI_ANALYTICS_DIMENSION_IDS[6];
    const provenance = payload.stones[dimensionId].generationProvenance;
    const questionId = provenance.sourceQuestionIds[0];

    provenance.sourceQuestionIds =
      mutation === 'missing'
        ? []
        : mutation === 'duplicate'
          ? [questionId, questionId]
          : [questionId, 'question-extra'];

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.ok(!validation.ok, mutation);
    assert.match(validation.error, new RegExp(dimensionId, 'u'));
  }
});

test('rejects numeric or Latin text in a visible metric insight', () => {
  const validInsight = createValidV6Payload().stones[
    AI_ANALYTICS_DIMENSION_IDS[2]
  ].metrics[0].insightText;
  for (const insightText of [
    validInsight.replace('התשובות', 'התשובות עשרים%'),
    validInsight.replace('התשובות', 'medium התשובות'),
  ]) {
    const payload = createValidV6Payload();
    const dimensionId = AI_ANALYTICS_DIMENSION_IDS[2];
    payload.stones[dimensionId].metrics[0].insightText = insightText;

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.ok(!validation.ok, insightText);
    assert.match(validation.error, new RegExp(dimensionId, 'u'));
  }
});

test('accepts a privacy-locked V6 result without detailed analysis', () => {
  const payload = {
    contractVersion: AI_ANALYTICS_V6_CONTRACT_VERSION,
    roundId: 'round-v6-locked',
    surveyDefinitionHash: SURVEY_DEFINITION_HASH,
    isLocked: true,
    status: 'locked_error',
    errorMessage: 'התוצאות נעולות עד להגעה לסף הפרטיות.',
  };

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.deepStrictEqual(validation, { ok: true, value: payload });
});

test('rejects each detailed field independently on a non-success result', () => {
  const completePayload = createValidV6Payload();
  const detailVariants = [
    { stones: completePayload.stones },
    {
      overallPsychologicalSummary:
        completePayload.overallPsychologicalSummary,
    },
  ];

  for (const details of detailVariants) {
    const payload = {
      contractVersion: AI_ANALYTICS_V6_CONTRACT_VERSION,
      roundId: 'round-v6-locked-with-details',
      surveyDefinitionHash: SURVEY_DEFINITION_HASH,
      isLocked: true,
      status: 'locked_error',
      ...details,
    };

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.ok(!validation.ok, Object.keys(details).join(','));
    assert.match(validation.error, /must not expose detailed results/i);
  }
});

test('does not accept the removed single psychologicalInterpretation field', () => {
  const payload = createValidV6Payload() as ReturnType<
    typeof createValidV6Payload
  > & {
    stones: Record<string, Record<string, unknown>>;
  };
  const dimensionId = AI_ANALYTICS_DIMENSION_IDS[3];
  payload.stones[dimensionId].psychologicalInterpretation =
    'זהו שדה ישן שאינו חלק מן החוזה החדש.';

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.ok(!validation.ok);
  assert.match(validation.error, new RegExp(dimensionId, 'u'));
});
