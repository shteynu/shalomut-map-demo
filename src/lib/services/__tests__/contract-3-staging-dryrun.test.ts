import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { encodeRoundAnalytics } from '../../analytics-encoder';
import { InMemoryAiInsightsRepository } from '../../repositories/in-memory/in-memory-ai-insights.repository';
import { InMemoryRoundRepository } from '../../repositories/in-memory/in-memory-round.repository';
import { InMemorySurveyRepository } from '../../repositories/in-memory/in-memory-survey.repository';
import {
  AI_ANALYTICS_DIMENSION_NAMES_HEBREW,
  StoneMapResult,
  validateStoneMapResult,
} from '../../ai-contract';
import type {
  AnswerValue,
  DynamicQuestionAggregate,
  RoundDimensionScore,
  SurveyDefinition,
  SurveyDefinitionQuestion,
  SurveyResponseRecord,
  SurveyRound,
} from '../../types/backend';
import type { WellbeingDimensionId } from '../../shalomut-source';
import { AnalyticsService } from '../analytics.service';
import { SurveyService } from '../survey.service';
import { createSurveyDefinitionHash } from '../../survey-definition-hash';

const ALL_DIMENSION_IDS: WellbeingDimensionId[] = [
  'self-expression',
  'professional-competence',
  'social-resource',
  'balance',
  'management-support',
  'certainty',
  'organizational-climate',
  'meaning',
];

let previousContractVersion: string | undefined;

before(() => {
  previousContractVersion = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '3.0';
});

after(() => {
  if (previousContractVersion === undefined) {
    delete process.env.AI_ANALYTICS_CONTRACT_VERSION;
  } else {
    process.env.AI_ANALYTICS_CONTRACT_VERSION = previousContractVersion;
  }
});

function createCustomSurveyDefinition(
  questions: SurveyDefinitionQuestion[],
): SurveyDefinition {
  return {
    title: 'שאלון מותאם אישית להרצה ניסיונית',
    audience: 'צוות בית הספר',
    estimatedMinutes: 8,
    minimumResponses: 10,
    introText: 'ברוכים הבאים לסקר האיכותי בסביבת הניסוי.',
    anonymityText: 'כל התשובות אנונימיות לחלוטין ומוצגות רק מעל סף הפרטיות.',
    questions,
  };
}

function createRoundFixture(
  id: string,
  organizationId: string,
  surveyDefinition: SurveyDefinition,
): SurveyRound {
  return {
    id,
    organizationId,
    title: surveyDefinition.title,
    status: 'closed',
    shareCode: `DRYRUN-${id.substring(0, 8).toUpperCase()}`,
    privacyThreshold: 10,
    startDate: new Date('2026-07-26T12:00:00.000Z'),
    surveyDefinition,
    createdAt: new Date('2026-07-26T12:00:00.000Z'),
  };
}

/**
 * Respondents only ever pick one of the three scale values, so the fixture
 * rotates over those and derives the score the same way production does. A raw
 * score array drifted outside the `100 | 60 | 0` scale the records actually
 * carry.
 */
const ANSWER_ROTATION: AnswerValue[] = [
  'green',
  'green',
  'green',
  'yellow',
  'green',
  'green',
  'yellow',
  'green',
];

function createMockResponses(
  roundId: string,
  questions: SurveyDefinitionQuestion[],
  count: number,
  omitAnswersForQuestionId?: string,
): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, responseIndex) => {
    const answers = questions
      .filter((q) => !omitAnswersForQuestionId || q.id !== omitAnswersForQuestionId || responseIndex < count - 1)
      .map((question, questionIndex) => {
        const value =
          ANSWER_ROTATION[(questionIndex + responseIndex) % ANSWER_ROTATION.length];
        const score = SurveyService.valueToScore(value);
        return {
          questionId: question.id,
          dimensionId: question.dimensionId,
          value,
          score,
        };
      });

    return {
      id: `${roundId}_resp_${responseIndex + 1}`,
      roundId,
      submittedAt: new Date('2026-07-26T12:05:00.000Z'),
      answers,
    };
  });
}

test('Workstream A Dry-Run: Scenario A1 (Unlocked disposable round with custom questionnaire contract 3.0)', async () => {
  const roundId = 'round_staging_dryrun_a1_unlocked';
  const orgId = 'org_staging_dryrun_a1';

  // 8 custom questions covering all 8 canonical dimensions with non-standard IDs and custom text
  const customQuestions: SurveyDefinitionQuestion[] = ALL_DIMENSION_IDS.map(
    (dimensionId, index) => ({
      id: `custom-q${index + 1}-${dimensionId}`,
      dimensionId,
      text: `שאלה מותאמת סבב ${index + 1} בממד ${AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId]}`,
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    }),
  );

  const surveyDefinition = createCustomSurveyDefinition(customQuestions);
  const round = createRoundFixture(roundId, orgId, surveyDefinition);
  const responses = createMockResponses(roundId, customQuestions, 10);

  const roundRepo = new InMemoryRoundRepository([round]);
  const surveyRepo = new InMemorySurveyRepository(responses);

  // 1. Calculate analytics via AnalyticsService
  const analytics = await AnalyticsService.getAnalyticsForRound(
    roundId,
    roundRepo,
    surveyRepo,
  );

  assert.ok(analytics, 'Analytics result must not be null');
  assert.strictEqual(encodeRoundAnalytics(analytics).contractVersion, '3.0');
  assert.strictEqual(analytics.roundId, roundId);
  assert.strictEqual(analytics.organizationId, orgId);
  assert.strictEqual(analytics.isLocked, false);
  assert.strictEqual(analytics.totalResponses, 10);
  assert.strictEqual(analytics.privacyThreshold, 10);

  const expectedHash = createSurveyDefinitionHash(customQuestions);
  assert.strictEqual(analytics.surveyDefinitionHash, expectedHash);

  // Check 8 stones in dimensionScores
  const dimensionKeys = Object.keys(analytics.dimensionScores);
  assert.strictEqual(dimensionKeys.length, 8);
  for (const dimId of ALL_DIMENSION_IDS) {
    // Annotated because `assert.ok` narrowing needs a declared type here.
    const dimScore: RoundDimensionScore | undefined =
      analytics.dimensionScores[dimId];
    assert.ok(dimScore);
    assert.strictEqual(dimScore.dimensionId, dimId);
    assert.strictEqual(dimScore.isLocked, false);
    assert.strictEqual(dimScore.totalResponses, 10);
    assert.ok(dimScore.averageScore >= 0 && dimScore.averageScore <= 100);
    assert.ok(['green', 'yellow', 'red'].includes(dimScore.computedStatus));
  }

  // Check questionAggregates cover exact custom question IDs
  const aggregateKeys = Object.keys(analytics.questionAggregates);
  assert.strictEqual(aggregateKeys.length, 8);
  for (const question of customQuestions) {
    const aggregate: DynamicQuestionAggregate | undefined =
      analytics.questionAggregates[question.id];
    assert.ok(aggregate, `Aggregate for ${question.id} must exist`);
    assert.strictEqual(aggregate.questionId, question.id);
    assert.strictEqual(aggregate.dimensionId, question.dimensionId);
    assert.strictEqual(aggregate.questionText, question.text);
    assert.strictEqual(aggregate.responseCount, 10);
  }

  // 2. Simulate AI service response (StoneMapResult contract 3.0)
  const aiPayload: StoneMapResult = {
    contractVersion: '3.0',
    roundId,
    processedAt: new Date().toISOString(),
    surveyDefinitionHash: expectedHash,
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary:
      'תמונת המצב הבית-ספרית בסבב הניסיוני מראה חוסן ארגוני גבוה ותפקוד מיטבי של הצוות.',
    stones: Object.fromEntries(
      ALL_DIMENSION_IDS.map((dimId) => {
        const dimScore = analytics.dimensionScores[dimId];
        const q = customQuestions.find((q) => q.dimensionId === dimId)!;
        const qAgg = analytics.questionAggregates[q.id];

        return [
          dimId,
          {
            dimensionId: dimId,
            dimensionNameHebrew: AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimId],
            status: dimScore.computedStatus,
            score: dimScore.averageScore,
            psychologicalInterpretation:
              'תגובות הצוות מעידות על סביבת עבודה תומכת ויציבה. הנתונים המצרפיים משקפים חוזקה משמעותית.',
            recommendedInterventions: [
              {
                id: `interv-${dimId}-1`,
                dimensionId: dimId,
                status: dimScore.computedStatus,
                source: 'מפתח ההתערבויות הבינלאומי',
                title: 'חיזוק מנגנוני שיתוף פעולה',
                summary: 'תוכנית עבודה ממוקדת לשימור והעמקת מנגנוני התמיכה.',
                actionable_steps: [
                  'קידום מפגשים תקופתיים לפיתוח מקצועי.',
                  'ביסוס ערוצי תקשורת פתוחים ומכבדים.',
                ],
              },
            ],
            metrics: [
              {
                questionId: q.id,
                label: q.text,
                value: 'מענה חיובי ועקבי',
                averageScore: qAgg.averageScore,
                responseCount: qAgg.responseCount,
              },
            ],
            generationProvenance: {
              outcome: 'llm',
              attempts: 1,
              retryCount: 0,
              sourceQuestionIds: [q.id],
              surveyDefinitionHash: expectedHash,
            },
          },
        ];
      }),
    ) as Record<WellbeingDimensionId, any>,
  };

  // Validate AI callback payload against schema & round analytics contract
  const validation = validateStoneMapResult(aiPayload, roundId);
  assert.ok(
    validation.ok,
    `Validation should succeed but failed: ${validation.ok ? '' : validation.error}`,
  );

  // Persist to in-memory repository and read back
  const aiInsightsRepo = new InMemoryAiInsightsRepository(roundRepo);
  const saved = await aiInsightsRepo.save(roundId, aiPayload);
  assert.ok(saved, 'AI insights should be saved successfully');

  const retrieved = await aiInsightsRepo.findByRoundId(roundId);
  assert.deepStrictEqual(retrieved, aiPayload);
});

test('Workstream A Dry-Run: Scenario A2.1 (Privacy locked round with < 10 total responses)', async () => {
  const roundId = 'round_staging_dryrun_a2_locked_count';
  const orgId = 'org_staging_dryrun_a2';

  const customQuestions: SurveyDefinitionQuestion[] = ALL_DIMENSION_IDS.map(
    (dimensionId, index) => ({
      id: `custom-q${index + 1}-${dimensionId}`,
      dimensionId,
      text: `שאלה מותאמת ${index + 1}`,
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    }),
  );

  const surveyDefinition = createCustomSurveyDefinition(customQuestions);
  const round = createRoundFixture(roundId, orgId, surveyDefinition);
  // Only 9 responses (< privacy threshold 10)
  const responses = createMockResponses(roundId, customQuestions, 9);

  const roundRepo = new InMemoryRoundRepository([round]);
  const surveyRepo = new InMemorySurveyRepository(responses);

  const analytics = await AnalyticsService.getAnalyticsForRound(
    roundId,
    roundRepo,
    surveyRepo,
  );

  assert.ok(analytics);
  assert.strictEqual(encodeRoundAnalytics(analytics).contractVersion, '3.0');
  assert.strictEqual(analytics.totalResponses, 9);
  assert.strictEqual(analytics.privacyThreshold, 10);
  assert.strictEqual(analytics.isLocked, true);
  assert.deepStrictEqual(analytics.dimensionScores, {});
  assert.deepStrictEqual(analytics.questionAggregates, {});

  // Locked AI result
  const lockedAiPayload: StoneMapResult = {
    contractVersion: '3.0',
    roundId,
    processedAt: new Date().toISOString(),
    surveyDefinitionHash: createSurveyDefinitionHash(customQuestions),
    isLocked: true,
    status: 'locked_error',
    errorMessage: 'הסבב נעול מטעמי פרטיות (פחות מ-10 מענים).',
  };

  const validation = validateStoneMapResult(lockedAiPayload, roundId);
  assert.ok(
    validation.ok,
    `Locked validation should succeed but failed: ${validation.ok ? '' : validation.error}`,
  );
});

test('Workstream A Dry-Run: Scenario A2.2 (Privacy locked round with 1 question below threshold)', async () => {
  const roundId = 'round_staging_dryrun_a2_locked_question';
  const orgId = 'org_staging_dryrun_a2';

  const customQuestions: SurveyDefinitionQuestion[] = ALL_DIMENSION_IDS.map(
    (dimensionId, index) => ({
      id: `custom-q${index + 1}-${dimensionId}`,
      dimensionId,
      text: `שאלה מותאמת ${index + 1}`,
      required: true,
      enabled: true,
      answerMode: 'סקאלת צבעים',
    }),
  );

  const surveyDefinition = createCustomSurveyDefinition(customQuestions);
  const round = createRoundFixture(roundId, orgId, surveyDefinition);
  // 10 responses, but custom-q1-self-expression has only 9 answers
  const responses = createMockResponses(
    roundId,
    customQuestions,
    10,
    'custom-q1-self-expression',
  );

  const roundRepo = new InMemoryRoundRepository([round]);
  const surveyRepo = new InMemorySurveyRepository(responses);

  const analytics = await AnalyticsService.getAnalyticsForRound(
    roundId,
    roundRepo,
    surveyRepo,
  );

  assert.ok(analytics);
  assert.strictEqual(encodeRoundAnalytics(analytics).contractVersion, '3.0');
  assert.strictEqual(analytics.totalResponses, 10);
  assert.strictEqual(analytics.privacyThreshold, 10);
  assert.strictEqual(analytics.isLocked, true);
  assert.deepStrictEqual(analytics.dimensionScores, {});
  assert.deepStrictEqual(analytics.questionAggregates, {});
});

test('Workstream A Dry-Run: Contract 5.0 calculates scoreDistribution per question', async () => {
  const previousEnv = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '5.0';
  try {
    const roundId = 'round-v5-test';
    const orgId = 'org-v5-test';
    const customQuestions: SurveyDefinitionQuestion[] = ALL_DIMENSION_IDS.map(
      (dimensionId, index) => ({
        id: `q-${index + 1}`,
        dimensionId,
        text: `שאלה מותאמת למימד ${dimensionId}`,
        required: true,
        enabled: true,
        answerMode: 'סקאלת צבעים',
      }),
    );
    const surveyDefinition = createCustomSurveyDefinition(customQuestions);
    const round = createRoundFixture(roundId, orgId, surveyDefinition);

    const responses: SurveyResponseRecord[] = [];
    for (let r = 0; r < 10; r++) {
      const val: 'green' | 'yellow' | 'red' = r < 5 ? 'green' : r < 8 ? 'yellow' : 'red';
      const score: 100 | 60 | 0 = r < 5 ? 100 : r < 8 ? 60 : 0;
      responses.push({
        id: `resp-${r + 1}`,
        roundId,
        submittedAt: new Date(),
        answers: customQuestions.map((q) => ({
          questionId: q.id,
          dimensionId: q.dimensionId,
          value: val,
          score,
        })),
      });
    }

    const roundRepo = new InMemoryRoundRepository([round]);
    const surveyRepo = new InMemorySurveyRepository(responses);

    const analytics = await AnalyticsService.getAnalyticsForRound(
      roundId,
      roundRepo,
      surveyRepo,
    );

    assert.ok(analytics);
    const encoded = encodeRoundAnalytics(analytics);
    assert.strictEqual(encoded.contractVersion, '5.0');
    assert.strictEqual(analytics.isLocked, false);
    assert.ok(encoded.questionAggregates['q-1'].scoreDistribution);
    assert.deepStrictEqual(
      encoded.questionAggregates['q-1'].scoreDistribution,
      { green: 5, yellow: 3, red: 2 },
    );
  } finally {
    if (previousEnv === undefined) {
      delete process.env.AI_ANALYTICS_CONTRACT_VERSION;
    } else {
      process.env.AI_ANALYTICS_CONTRACT_VERSION = previousEnv;
    }
  }
});
