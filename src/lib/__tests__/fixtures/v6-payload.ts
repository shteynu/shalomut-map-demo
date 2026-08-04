import {
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  AI_ANALYTICS_V6_CONTRACT_VERSION,
} from '../../ai-contract';

/**
 * A complete, valid Contract V6 callback payload.
 *
 * It lives outside a `.test.ts` file so more than one suite can start from a
 * valid payload and change the single thing it is about. Importing it from a
 * test module instead would run that module's own tests again in every suite
 * that borrowed the builder.
 */

export const SURVEY_DEFINITION_HASH = `sha256:${'a'.repeat(64)}`;

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
              // Widened deliberately: 6.0 carries gaps, so a fixture that
              // could not express one would exclude the cases worth testing.
              outcome: 'llm' as 'llm' | 'deterministic_fallback' | 'unavailable',
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
