import {
  AI_ANALYTICS_CONTRACT_VERSION,
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
  AI_ANALYTICS_QUESTIONS,
  AI_ANALYTICS_V1_CONTRACT_VERSION,
} from '../../ai-contract';

/**
 * Complete, valid callback payloads for the closed contracts `1.0`, `2.0` and
 * `3.0`.
 *
 * The suite already had a valid V6 payload to break one rule at a time. The
 * older versions had only payloads that pass — and the `1.0` one carried empty
 * `metrics` and `recommendedInterventions`, so the validators for a legacy
 * metric and a legacy intervention were never entered at all.
 *
 * These builders keep the shape a real callback has: every canonical question
 * of a dimension appears as a metric, provenance names exactly those question
 * IDs, and the interventions carry the stone's own status. Breaking one field
 * of one of them is then a statement about the rule, not about the fixture.
 *
 * They live outside a `.test.ts` file for the reason `v6-payload.ts` gives:
 * importing a builder from a test module runs that module's tests again.
 */

export const LEGACY_SURVEY_DEFINITION_HASH = `sha256:${'b'.repeat(64)}`;

/** Two complete Hebrew sentences: what `1.0`–`3.0` ask a stone to carry. */
const TWO_SENTENCE_INTERPRETATION =
  'התשובות מצביעות על בסיס יציב לצד שונות בין המשתתפים. כדאי לבחון יחד עם הצוות מה מחזק את התחושה הזאת.';

function questionsFor(dimensionId: string) {
  return AI_ANALYTICS_QUESTIONS.filter(
    (question) => question.dimensionId === dimensionId,
  );
}

function interventionsFor(dimensionId: string, status: 'green' | 'yellow' | 'red') {
  return Array.from({ length: 2 }, (_, index) => ({
    id: `${dimensionId}-intervention-${index + 1}`,
    dimensionId,
    status,
    source: 'shalomut_catalog',
    title: 'מהלך צוותי ממוקד',
    summary: 'המהלך המוצע מחזק שגרה משותפת וברורה בצוות.',
    actionable_steps: [
      'לקבוע זמן קבוע לשיחה קצרה עם הצוות.',
      'לאסוף משוב ולבחון את ההתקדמות יחד.',
    ],
  }));
}

/**
 * Contract `1.0`: structural only. The copy may be any string, the metrics are
 * free-form label/value pairs, and nothing binds a stone to the questionnaire.
 */
export function createValidV1Payload(roundId = 'round-v1') {
  return {
    contractVersion: AI_ANALYTICS_V1_CONTRACT_VERSION,
    roundId,
    processedAt: '2026-07-24T12:00:00.000Z',
    isLocked: false,
    status: 'success' as const,
    overallPsychologicalSummary: 'Structural legacy summary.',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => [
        dimensionId,
        {
          dimensionId,
          dimensionNameHebrew: AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId],
          status: 'yellow' as const,
          score: 60,
          psychologicalInterpretation: 'Legacy structural copy.',
          recommendedInterventions: interventionsFor(dimensionId, 'yellow'),
          metrics: [
            { label: 'ממוצע', value: '60', trend: 'יציב' },
            { label: 'משיבים', value: '10' },
          ],
        },
      ]),
    ) as Record<string, Record<string, unknown>>,
  };
}

/**
 * Contract `2.0`: the first semantic one. Hebrew-only user text, a metric per
 * canonical question, and provenance naming exactly that dimension's questions.
 */
export function createValidV2Payload(roundId = 'round-v2') {
  return {
    contractVersion: AI_ANALYTICS_CONTRACT_VERSION,
    roundId,
    processedAt: '2026-07-28T12:00:00.000Z',
    isLocked: false,
    status: 'success' as const,
    overallPsychologicalSummary:
      'התמונה הכללית מצביעה על שילוב של כוחות ושל אזורים הזקוקים לתשומת לב. מומלץ להתקדם באופן הדרגתי.',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => {
        const questions = questionsFor(dimensionId);
        return [
          dimensionId,
          {
            dimensionId,
            dimensionNameHebrew:
              AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId],
            status: 'yellow' as const,
            score: 60,
            psychologicalInterpretation: TWO_SENTENCE_INTERPRETATION,
            recommendedInterventions: interventionsFor(dimensionId, 'yellow'),
            metrics: questions.map((question) => ({
              questionId: question.id,
              label: question.textHebrew,
              value: 'מגמה בינונית',
              averageScore: 60,
              responseCount: 10,
              trend: 'יציב',
            })),
            generationProvenance: {
              outcome: 'llm' as const,
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: questions.map((question) => question.id),
            },
          },
        ];
      }),
    ) as Record<string, Record<string, unknown>>,
  };
}

/**
 * Contract `3.0`: the questionnaire is the round's own, so the metrics carry
 * round-scoped question IDs and provenance is bound to the snapshot hash.
 */
export function createValidV3Payload(roundId = 'round-v3') {
  return {
    contractVersion: AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
    roundId,
    processedAt: '2026-07-30T12:00:00.000Z',
    surveyDefinitionHash: LEGACY_SURVEY_DEFINITION_HASH,
    isLocked: false,
    status: 'success' as const,
    overallPsychologicalSummary:
      'התמונה הכללית מצביעה על שילוב של כוחות ושל אזורים הזקוקים לתשומת לב. מומלץ להתקדם באופן הדרגתי.',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId, dimensionIndex) => {
        const questionIds = [
          `round-question-${dimensionIndex + 1}-a`,
          `round-question-${dimensionIndex + 1}-b`,
        ];
        return [
          dimensionId,
          {
            dimensionId,
            dimensionNameHebrew:
              AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId],
            status: 'yellow' as const,
            score: 60,
            psychologicalInterpretation: TWO_SENTENCE_INTERPRETATION,
            recommendedInterventions: interventionsFor(dimensionId, 'yellow'),
            metrics: questionIds.map((questionId) => ({
              questionId,
              label: 'עד כמה התחושה בתחום זה יציבה',
              value: 'מגמה בינונית',
              averageScore: 60,
              responseCount: 10,
              trend: 'יציב',
            })),
            generationProvenance: {
              outcome: 'llm' as const,
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: [...questionIds],
              surveyDefinitionHash: LEGACY_SURVEY_DEFINITION_HASH,
              backgroundContextIncluded: false,
            },
          },
        ];
      }),
    ) as Record<string, Record<string, unknown>>,
  };
}
