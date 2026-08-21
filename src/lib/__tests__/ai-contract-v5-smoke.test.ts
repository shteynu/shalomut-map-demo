import assert from 'node:assert';
import test from 'node:test';
import {
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  AI_ANALYTICS_V5_CONTRACT_VERSION,
  validateStoneMapResult,
} from '../ai-contract';
import { encodeRoundAnalytics } from '../analytics-encoder';
import { AnalyticsService } from '../services/analytics.service';
import { createSurveyDefinitionHash } from '../survey-definition-hash';
import type {
  AnalyticSurveyQuestion,
  SurveyResponseRecord,
  SurveyRound,
} from '../types/backend';
import type { WellbeingDimensionId } from '../shalomut-source';

const DIMENSION_IDS: WellbeingDimensionId[] = [
  'self-expression',
  'professional-competence',
  'social-resource',
  'balance',
  'management-support',
  'certainty',
  'organizational-climate',
  'meaning',
];

test('Smoke Test 1: Full Contract 5.0 analytical calculation and validation', async () => {
  const roundId = 'smoke-round-5';
  const orgId = 'smoke-org-5';
  const questions: AnalyticSurveyQuestion[] = DIMENSION_IDS.map((dim, idx) => ({
    id: `q-smoke-${idx + 1}`,
    dimensionId: dim,
    text: `שאלה בסקר לתחום ${AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dim]}`,
    required: true,
    enabled: true,
    kind: "analytic" as const,
    scaleId: "wellbeing-colour" as const,
    polarity: "positive" as const,
  }));

  const round: SurveyRound = {
    id: roundId,
    organizationId: orgId,
    title: 'סקר סמוק 5.0',
    // Closed, because this smoke is about what a published round carries
    // across the 5.0 boundary. A round still collecting publishes nothing at
    // all (ADR-030), which would make every assertion below vacuous.
    status: 'closed',
    shareCode: 'SMOKE50',
    privacyThreshold: 10,
    startDate: new Date(),
    surveyDefinition: {
      title: 'סקר סמוק 5.0',
      audience: 'צוות',
      estimatedMinutes: 5,
      minimumResponses: 10,
      introText: 'סקר',
      anonymityText: 'אנונימי',
      questions,
    },
    createdAt: new Date(),
  };

  // Ten answers, half green and half yellow: the smallest round that clears
  // the required privacy threshold.
  const responses: SurveyResponseRecord[] = Array.from(
    { length: 10 },
    (_, index) => ({
      id: `resp-${index + 1}`,
      roundId,
      submittedAt: new Date(),
      answers: questions.map((q) => ({
        questionId: q.id,
        dimensionId: q.dimensionId,
        value: index < 5 ? ('green' as const) : ('yellow' as const),
        score: index < 5 ? (100 as const) : (60 as const),
      })),
    }),
  );

  const previousEnv = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '5.0';

  try {
    const analytics = AnalyticsService.calculateDynamicRoundAnalytics(round, responses);
    const encoded = encodeRoundAnalytics(analytics);
    assert.strictEqual(encoded.contractVersion, '5.0');
    assert.strictEqual(analytics.isLocked, false);
    assert.strictEqual(analytics.totalResponses, 10);

    const firstQuestionDist =
      encoded.questionAggregates['q-smoke-1'].scoreDistribution;
    assert.ok(firstQuestionDist);
    assert.deepStrictEqual(firstQuestionDist, { green: 5, yellow: 5, red: 0 });

    // Validate a valid 5.0 Stone Map payload
    const hash = createSurveyDefinitionHash(questions);
    const validStoneMap = {
      contractVersion: '5.0',
      roundId,
      processedAt: new Date().toISOString(),
      isLocked: false,
      status: 'success',
      overallPsychologicalSummary: 'הניתוח הארגוני המקיף מצביע על תמונה מאוזנת בצוות. ישנן חוזקות בולטות לצד תחומים המצריכים יעד ניהולי.',
      surveyDefinitionHash: hash,
      stones: Object.fromEntries(
        DIMENSION_IDS.map((dim) => [
          dim,
          {
            dimensionId: dim,
            dimensionNameHebrew: AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dim],
            status: 'green',
            score: 80,
            psychologicalInterpretation: 'תמונת המצב במדד זה מציגה יציבות ארגונית וביטחון פסיכולוגי. הצוות חווה תמיכה ומשאבים מתאימים.',
            recommendedInterventions: [],
            metrics: [
              {
                label: `שאלה בסקר לתחום ${AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dim]}`,
                value: '80 מתוך 100',
                questionId: `q-smoke-${DIMENSION_IDS.indexOf(dim) + 1}`,
                averageScore: 80,
                responseCount: 10,
                scoreDistribution: { green: 5, yellow: 5, red: 0 },
              },
            ],
            generationProvenance: {
              outcome: 'llm',
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: [`q-smoke-${DIMENSION_IDS.indexOf(dim) + 1}`],
              surveyDefinitionHash: hash,
              distributionIncluded: true,
              crossDimensionContextIncluded: true,
            },
          },
        ]),
      ),
    };

    const validation = validateStoneMapResult(validStoneMap, roundId);
    if (!validation.ok) {
      console.error(validation.error);
    }
    assert.strictEqual(validation.ok, true);
  } finally {
    process.env.AI_ANALYTICS_CONTRACT_VERSION = previousEnv;
  }
});
