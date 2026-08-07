import {
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  AI_ANALYTICS_V5_CONTRACT_VERSION,
} from '../../ai-contract';

/**
 * A complete, valid Contract `5.0` callback payload.
 *
 * `ai-contract-v5.test.ts` builds its own, and this one is separate on purpose:
 * a builder imported from a test module runs that module's tests again in every
 * suite that borrows it, which is the reason `v6-payload.ts` and
 * `legacy-payloads.ts` live here too.
 *
 * Two metrics per stone, not one. The rules worth breaking on `5.0` are about
 * sets — the question IDs a stone reports, the IDs its provenance names, the
 * dimensions a partial map declares — and a one-element set hides the
 * difference between "every" and "some".
 */

export const V5_SURVEY_DEFINITION_HASH = `sha256:${'d'.repeat(64)}`;

/** Between two and five sentences: what a `5.0` stone may carry. */
const INTERPRETATION =
  'התשובות מצביעות על בסיס יציב לצד שונות בין המשתתפים. נראה כי השיח המשותף מסייע לצוות. כדאי לבחור צעד ממוקד אחד ולבדוק אותו בהמשך.';

export function createValidV5Payload(roundId = 'round-v5') {
  return {
    contractVersion: AI_ANALYTICS_V5_CONTRACT_VERSION,
    roundId,
    processedAt: '2026-08-01T12:00:00.000Z',
    surveyDefinitionHash: V5_SURVEY_DEFINITION_HASH,
    isLocked: false,
    status: 'success' as const,
    // 5.0 caps the round summary at two to four sentences.
    overallPsychologicalSummary:
      'התמונה הכללית מצביעה על שילוב של כוחות ושל אזורים הזקוקים לתשומת לב. מומלץ להתקדם באופן הדרגתי ולבדוק את השינוי יחד עם הצוות.',
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
            psychologicalInterpretation: INTERPRETATION,
            recommendedInterventions: Array.from({ length: 2 }, (_, index) => ({
              id: `${dimensionId}-intervention-${index + 1}`,
              dimensionId,
              status: 'yellow' as const,
              source: 'shalomut_catalog',
              title: 'מהלך צוותי ממוקד',
              summary: 'המהלך המוצע מחזק שגרה משותפת וברורה בצוות.',
              actionable_steps: [
                'לקבוע זמן קבוע לשיחה קצרה עם הצוות.',
                'לאסוף משוב ולבחון את ההתקדמות יחד.',
              ],
              adaptationOutcome: 'llm' as const,
            })),
            metrics: questionIds.map((questionId) => ({
              questionId,
              label: 'עד כמה התחושה בתחום זה יציבה',
              value: 'מגמה בינונית',
              averageScore: 60,
              responseCount: 20,
              scoreDistribution: { green: 6, yellow: 10, red: 4 },
            })),
            generationProvenance: {
              outcome: 'llm' as string,
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: [...questionIds],
              surveyDefinitionHash: V5_SURVEY_DEFINITION_HASH,
              backgroundContextIncluded: true,
              distributionIncluded: true,
              crossDimensionContextIncluded: true,
            } as Record<string, unknown>,
          },
        ];
      }),
    ) as Record<string, Record<string, any>>,
  };
}

/**
 * The same payload with the named dimensions carrying no interpretation, and
 * the declaration that goes with them.
 *
 * A gap is three coordinated facts — the outcome, the empty interpretation and
 * the list on the payload — so a fixture that produced one without the others
 * would only ever prove that the validator refuses an inconsistent payload.
 */
export function createPartialV5Payload(
  dimensionIds: string[],
  roundId = 'round-v5',
) {
  const payload = createValidV5Payload(roundId);
  for (const dimensionId of dimensionIds) {
    const stone = payload.stones[dimensionId];
    stone.psychologicalInterpretation = '';
    stone.generationProvenance.outcome = 'unavailable';
    stone.generationProvenance.attempts = 2;
    stone.generationProvenance.retryCount = 1;
    stone.generationProvenance.unavailableReason = 'provider_unavailable';
  }
  (payload as Record<string, unknown>).dimensionsWithoutInterpretation = [
    ...dimensionIds,
  ];
  return payload;
}
