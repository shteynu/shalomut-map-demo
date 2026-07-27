import assert from 'node:assert';
import test from 'node:test';
import {
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  AI_ANALYTICS_V5_CONTRACT_VERSION,
  validateStoneMapResult,
} from '../ai-contract';
import { AnalyticsService } from '../services/analytics.service';
import { createSurveyDefinitionHash } from '../survey-definition-hash';
import type {
  SurveyDefinitionQuestion,
  SurveyResponseRecord,
  SurveyRound,
  WellbeingDimensionId,
} from '../types/backend';

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
  const questions: SurveyDefinitionQuestion[] = DIMENSION_IDS.map((dim, idx) => ({
    id: `q-smoke-${idx + 1}`,
    dimensionId: dim,
    text: `שאלה בסקר לתחום ${AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dim]}`,
    required: true,
    enabled: true,
    answerMode: 'סקאלת צבעים',
  }));

  const round: SurveyRound = {
    id: roundId,
    organizationId: orgId,
    title: 'סקר סמוק 5.0',
    status: 'active',
    shareCode: 'SMOKE50',
    privacyThreshold: 1,
    startDate: new Date(),
    surveyDefinition: {
      title: 'סקר סמוק 5.0',
      audience: 'צוות',
      estimatedMinutes: 5,
      minimumResponses: 1,
      introText: 'סקר',
      anonymityText: 'אנונימי',
      questions,
    },
    createdAt: new Date(),
  };

  const responses: SurveyResponseRecord[] = [
    {
      id: 'resp-1',
      roundId,
      submittedAt: new Date(),
      answers: questions.map((q) => ({
        questionId: q.id,
        dimensionId: q.dimensionId,
        value: 'green',
        score: 100,
      })),
    },
    {
      id: 'resp-2',
      roundId,
      submittedAt: new Date(),
      answers: questions.map((q) => ({
        questionId: q.id,
        dimensionId: q.dimensionId,
        value: 'yellow',
        score: 60,
      })),
    },
  ];

  const previousEnv = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '5.0';

  try {
    const analytics = AnalyticsService.calculateDynamicRoundAnalytics(round, responses);
    assert.strictEqual(analytics.contractVersion, '5.0');
    assert.strictEqual(analytics.isLocked, false);
    assert.strictEqual(analytics.totalResponses, 2);

    const firstQuestionDist = analytics.questionAggregates['q-smoke-1'].scoreDistribution;
    assert.ok(firstQuestionDist);
    assert.deepStrictEqual(firstQuestionDist, { green: 1, yellow: 1, red: 0 });

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
                responseCount: 2,
                scoreDistribution: { green: 1, yellow: 1, red: 0 },
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
