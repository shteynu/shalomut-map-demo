import {
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  AI_ANALYTICS_V7_CONTRACT_VERSION,
} from '../../ai-contract';

/**
 * A complete, valid Contract V7 callback payload.
 *
 * 7.0 is 6.0 with the metric narrative gone and the answer scale named on
 * every metric, so this builder starts from the same shape as the V6 one and
 * differs in exactly those two things. It lives beside `v6-payload.ts` for the
 * same reason that file exists: more than one suite starts from a valid
 * payload and changes the single thing it is about.
 */

export const V7_SURVEY_DEFINITION_HASH = `sha256:${'c'.repeat(64)}`;

function narrative(seed: string): string {
  return `${seed} ${'הטקסט מתאר את המשמעות הרגשית והחברתית של התשובות ומציע התבוננות זהירה המבוססת רק על המידע שנאסף. '.repeat(4)}`.trim();
}

export function createValidV7Payload(roundId = 'round-v7') {
  return {
    contractVersion: AI_ANALYTICS_V7_CONTRACT_VERSION,
    roundId,
    processedAt: '2026-09-12T08:00:00.000Z',
    surveyDefinitionHash: V7_SURVEY_DEFINITION_HASH,
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
                // The instrument mixes its scales, so the fixture does too.
                scaleId: (dimensionIndex % 2 === 0
                  ? 'likert-5-extent'
                  : 'likert-7-frequency') as
                  | 'likert-5-extent'
                  | 'likert-7-frequency'
                  | 'wellbeing-colour',
                polarity: (dimensionIndex % 3 === 0 ? 'negative' : 'positive') as
                  | 'positive'
                  | 'negative',
              } as Record<string, unknown> & { questionId: string },
            ],
            generationProvenance: {
              outcome: 'llm' as 'llm' | 'deterministic_fallback' | 'unavailable',
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: [questionId],
              surveyDefinitionHash: V7_SURVEY_DEFINITION_HASH,
              backgroundContextIncluded: true,
              distributionIncluded: true,
              crossDimensionContextIncluded: true,
            } as Record<string, unknown>,
          },
        ];
      }),
    ),
  };
}
