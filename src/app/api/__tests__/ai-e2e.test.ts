import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { POST as mcpHandler } from '../mcp/route';
import {
  GET as getInsightsHandler,
  POST as postInsightsHandler,
} from '../rounds/[roundId]/ai-insights/route';
import {
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
  resetDefaultRepositories,
  setRepositories,
} from '@/lib/repositories';
import { surveyInstrument } from '@/lib/shalomut-source';
import type {
  AnswerValue,
  SurveyDefinition,
  SurveyDefinitionQuestion,
  SurveyResponseRecord,
} from '@/lib/types/backend';

const repositoryRoot = process.cwd();
const aiServiceRoot = path.join(repositoryRoot, 'ai-analytics-service');

type DynamicRoundFixture = {
  roundId: string;
  organizationId: string;
  definition: SurveyDefinition;
};

function definitionFromQuestions(
  title: string,
  questions: SurveyDefinitionQuestion[],
): SurveyDefinition {
  return {
    title,
    audience: 'כלל צוות ההוראה',
    estimatedMinutes: 10,
    minimumResponses: 10,
    introText: 'נשמח למענה כן ומכבד.',
    anonymityText: 'התוצאות מוצגות באופן מצרפי בלבד.',
    questions,
  };
}

function question(
  id: string,
  dimensionId: SurveyDefinitionQuestion['dimensionId'],
  text: string,
): SurveyDefinitionQuestion {
  return {
    id,
    dimensionId,
    text,
    required: true,
    enabled: true,
    answerMode: 'סקאלת צבעים',
  };
}

const compactQuestions = surveyInstrument.dimensions.map((dimension, index) =>
  question(
    `compact-${dimension.id}-${index + 1}`,
    dimension.id,
    `שאלת שלומות מותאמת לממד ${dimension.label} בסבב הקצר.`,
  ),
);

const revisedCanonicalText =
  'בסבב הזה יש לי מרחב בטוח לבטא עמדה מקצועית שונה.';
const expandedQuestions = [
  question('self-expression-1', 'self-expression', revisedCanonicalText),
  ...surveyInstrument.dimensions
    .filter((dimension) => dimension.id !== 'self-expression')
    .map((dimension, index) =>
      question(
        `expanded-${dimension.id}-${index + 1}`,
        dimension.id,
        `שאלה מותאמת לסבב המורחב בממד ${dimension.label}.`,
      ),
    ),
  question(
    'expanded-balance-recovery',
    'balance',
    'יש לי זמן קבוע להתאוששות במהלך שבוע העבודה.',
  ),
  question(
    'expanded-balance-boundaries',
    'balance',
    'גבולות יום העבודה ברורים לי ונשמרים ברוב השבוע.',
  ),
  question(
    'expanded-meaning-impact',
    'meaning',
    'אני מזהה השפעה מוחשית של העבודה שלי על הקהילה.',
  ),
];

const dynamicFixtures: DynamicRoundFixture[] = [
  {
    roundId: 'round_cross_service_compact',
    organizationId: 'org_cross_service_compact',
    definition: definitionFromQuestions('סבב קצר', compactQuestions),
  },
  {
    roundId: 'round_cross_service_expanded',
    organizationId: 'org_cross_service_expanded',
    definition: definitionFromQuestions('סבב מורחב', expandedQuestions),
  },
];

function createResponses(
  roundId: string,
  questions: SurveyDefinitionQuestion[],
  count: number,
  omitFromFirstResponse?: string,
): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, responseIndex) => ({
    id: `${roundId}_response_${responseIndex}`,
    roundId,
    submittedAt: new Date('2026-07-26T12:00:00.000Z'),
    answers: questions
      .filter(
        (candidate) =>
          responseIndex !== 0 || candidate.id !== omitFromFirstResponse,
      )
      .map((candidate) => {
        const value: AnswerValue =
          candidate.dimensionId === 'balance'
            ? 'red'
            : candidate.dimensionId === 'organizational-climate'
              ? 'yellow'
              : 'green';
        const score = value === 'green' ? 100 : value === 'yellow' ? 60 : 0;

        return {
          questionId: candidate.id,
          dimensionId: candidate.dimensionId,
          value,
          score,
        };
      }),
  }));
}

async function fetchMcpAnalytics(roundId: string) {
  const response = await mcpHandler(
    new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: roundId,
        method: 'tools/call',
        params: {
          name: 'get_round_analytics',
          arguments: { roundId },
        },
      }),
    }),
  );
  assert.strictEqual(response.status, 200);
  const json = await response.json();
  return JSON.parse(json.result.content[0].text);
}

function runPythonPipeline(analytics: unknown) {
  // The stub entry point runs the shipping pipeline with the provider calls
  // answered locally (`ai-analytics-service/tests/stub_pipeline_cli.py`). What
  // this test proves is the boundary — Core's aggregates in, a Stone Map Core
  // accepts back — and without a provider the round would now correctly fail
  // before ever reaching that assertion.
  const python = spawnSync('python3', ['-m', 'tests.stub_pipeline_cli'], {
    cwd: aiServiceRoot,
    input: JSON.stringify(analytics),
    encoding: 'utf8',
  });
  assert.strictEqual(python.status, 0, python.stderr);
  return JSON.parse(python.stdout);
}

function configureFixture(
  fixture: DynamicRoundFixture,
  responses: SurveyResponseRecord[],
) {
  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([
      {
        id: fixture.organizationId,
        name: 'בית ספר בדיקה',
        city: 'חיפה',
        schoolType: 'תיכון',
        totalStaffCount: 20,
        createdAt: new Date('2026-07-26T12:00:00.000Z'),
      },
    ]),
    roundRepo: new InMemoryRoundRepository([
      {
        id: fixture.roundId,
        organizationId: fixture.organizationId,
        title: fixture.definition.title,
        status: 'closed',
        shareCode: `SHALOM-${fixture.roundId.slice(-6).toUpperCase()}`,
        privacyThreshold: 10,
        startDate: new Date('2026-07-26T12:00:00.000Z'),
        surveyDefinition: fixture.definition,
        createdAt: new Date('2026-07-26T12:00:00.000Z'),
      },
    ]),
    surveyRepo: new InMemorySurveyRepository(responses),
  });
}

test('two dynamic questionnaires cross Core MCP -> Python -> callback with exact round metrics', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    for (const fixture of dynamicFixtures) {
      const enabledQuestions = fixture.definition.questions.filter(
        (candidate) => candidate.enabled,
      );
      configureFixture(
        fixture,
        createResponses(fixture.roundId, enabledQuestions, 10),
      );

      const analytics = await fetchMcpAnalytics(fixture.roundId);
      assert.strictEqual(analytics.contractVersion, '3.0');
      assert.strictEqual(analytics.organizationId, fixture.organizationId);
      assert.strictEqual(analytics.isLocked, false);
      assert.deepStrictEqual(
        Object.keys(analytics.questionAggregates).sort(),
        enabledQuestions.map((candidate) => candidate.id).sort(),
      );
      for (const candidate of enabledQuestions) {
        assert.strictEqual(
          analytics.questionAggregates[candidate.id].questionText,
          candidate.text,
        );
      }

      const stoneMap = runPythonPipeline(analytics);
      assert.strictEqual(stoneMap.contractVersion, '3.0');
      assert.strictEqual(
        stoneMap.surveyDefinitionHash,
        analytics.surveyDefinitionHash,
      );
      assert.strictEqual(Object.keys(stoneMap.stones).length, 8);

      if (fixture === dynamicFixtures[0]) {
        const firstDimension = surveyInstrument.dimensions[0].id;
        const tamperedScore = structuredClone(stoneMap);
        tamperedScore.stones[firstDimension].score = 60;
        tamperedScore.stones[firstDimension].status = 'yellow';
        const scoreRejection = await postInsightsHandler(
          new Request(
            `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(tamperedScore),
            },
          ),
          { params: Promise.resolve({ roundId: fixture.roundId }) },
        );
        assert.strictEqual(scoreRejection.status, 400);

        const tamperedAggregate = structuredClone(stoneMap);
        tamperedAggregate.stones[firstDimension].metrics[0].responseCount = 11;
        const aggregateRejection = await postInsightsHandler(
          new Request(
            `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(tamperedAggregate),
            },
          ),
          { params: Promise.resolve({ roundId: fixture.roundId }) },
        );
        assert.strictEqual(aggregateRejection.status, 400);
      }

      const callbackResponse = await postInsightsHandler(
        new Request(
          `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stoneMap),
          },
        ),
        { params: Promise.resolve({ roundId: fixture.roundId }) },
      );
      const callbackBody = await callbackResponse.clone().json();
      assert.strictEqual(
        callbackResponse.status,
        200,
        JSON.stringify(callbackBody),
      );

      const getResponse = await getInsightsHandler(
        new Request(
          `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
        ),
        { params: Promise.resolve({ roundId: fixture.roundId }) },
      );
      assert.strictEqual(getResponse.status, 200);
      const persisted = await getResponse.json();
      assert.strictEqual(persisted.contractVersion, '3.0');
      assert.strictEqual(Object.keys(persisted.stones).length, 8);

      for (const dimension of surveyInstrument.dimensions) {
        const expectedQuestions = enabledQuestions.filter(
          (candidate) => candidate.dimensionId === dimension.id,
        );
        const stone = persisted.stones[dimension.id];
        assert.strictEqual(stone.metrics.length, expectedQuestions.length);
        assert.deepStrictEqual(
          stone.metrics
            .map((metric: { questionId: string }) => metric.questionId)
            .sort(),
          expectedQuestions.map((candidate) => candidate.id).sort(),
        );
        assert.deepStrictEqual(
          stone.metrics
            .map((metric: { label: string }) => metric.label)
            .sort(),
          expectedQuestions.map((candidate) => candidate.text).sort(),
        );
        assert.deepStrictEqual(
          [...stone.generationProvenance.sourceQuestionIds].sort(),
          expectedQuestions.map((candidate) => candidate.id).sort(),
        );
        assert.strictEqual(
          stone.generationProvenance.surveyDefinitionHash,
          analytics.surveyDefinitionHash,
        );
      }
    }
  } finally {
    resetDefaultRepositories();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('a 5.0 round carries its distributions to Python and back under Core verification', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousContractVersion = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  delete process.env.DATABASE_URL;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '5.0';

  const fixture: DynamicRoundFixture = {
    roundId: 'round_cross_service_v5',
    organizationId: 'org_cross_service_v5',
    definition: definitionFromQuestions('סבב חמש אפס', compactQuestions),
  };
  const enabledQuestions = fixture.definition.questions.filter(
    (candidate) => candidate.enabled,
  );

  try {
    // A split staff rather than a uniform one: the buckets have to differ from
    // each other for a mismatch to be detectable at all.
    const responses: SurveyResponseRecord[] = Array.from(
      { length: 10 },
      (_, responseIndex) => ({
        id: `${fixture.roundId}_response_${responseIndex}`,
        roundId: fixture.roundId,
        submittedAt: new Date('2026-07-26T12:00:00.000Z'),
        answers: enabledQuestions.map((candidate) => {
          const value: AnswerValue =
            responseIndex % 3 === 0
              ? 'red'
              : responseIndex % 3 === 1
                ? 'yellow'
                : 'green';
          const score = value === 'green' ? 100 : value === 'yellow' ? 60 : 0;
          return {
            questionId: candidate.id,
            dimensionId: candidate.dimensionId,
            value,
            score,
          };
        }),
      }),
    );
    configureFixture(fixture, responses);

    const analytics = await fetchMcpAnalytics(fixture.roundId);
    assert.strictEqual(analytics.contractVersion, '5.0');
    const firstQuestionId = enabledQuestions[0].id;
    assert.deepStrictEqual(
      analytics.questionAggregates[firstQuestionId].scoreDistribution,
      { green: 3, yellow: 3, red: 4 },
    );

    const stoneMap = runPythonPipeline(analytics);
    assert.strictEqual(stoneMap.contractVersion, '5.0');

    for (const dimension of surveyInstrument.dimensions) {
      const stone = stoneMap.stones[dimension.id];
      for (const metric of stone.metrics) {
        assert.deepStrictEqual(
          metric.scoreDistribution,
          analytics.questionAggregates[metric.questionId].scoreDistribution,
        );
      }
      for (const intervention of stone.recommendedInterventions) {
        assert.ok(
          ['llm', 'deterministic_fallback'].includes(
            intervention.adaptationOutcome,
          ),
        );
      }
    }

    const tamperedDistribution = structuredClone(stoneMap);
    const tamperedStone =
      tamperedDistribution.stones[surveyInstrument.dimensions[0].id];
    // Same response count, different split: only the cross-check can catch it.
    tamperedStone.metrics[0].scoreDistribution = {
      green: 4,
      yellow: 3,
      red: 3,
    };
    const distributionRejection = await postInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tamperedDistribution),
        },
      ),
      { params: Promise.resolve({ roundId: fixture.roundId }) },
    );
    assert.strictEqual(distributionRejection.status, 400);
    // The tampered payload is internally consistent — three non-negative
    // integers summing to the response count — so only the comparison against
    // the recomputed analytics can reject it.
    assert.match(
      (await distributionRejection.json()).error,
      /distributions do not match the Core analytics/,
    );

    const missingDistribution = structuredClone(stoneMap);
    delete missingDistribution.stones[surveyInstrument.dimensions[0].id]
      .metrics[0].scoreDistribution;
    const missingRejection = await postInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(missingDistribution),
        },
      ),
      { params: Promise.resolve({ roundId: fixture.roundId }) },
    );
    assert.strictEqual(missingRejection.status, 400);

    const callbackResponse = await postInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stoneMap),
        },
      ),
      { params: Promise.resolve({ roundId: fixture.roundId }) },
    );
    const callbackBody = await callbackResponse.clone().json();
    assert.strictEqual(
      callbackResponse.status,
      200,
      JSON.stringify(callbackBody),
    );

    const getResponse = await getInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
      ),
      { params: Promise.resolve({ roundId: fixture.roundId }) },
    );
    assert.strictEqual(getResponse.status, 200);
    const persisted = await getResponse.json();
    assert.strictEqual(persisted.contractVersion, '5.0');
    assert.deepStrictEqual(
      persisted.stones[surveyInstrument.dimensions[0].id].metrics[0]
        .scoreDistribution,
      { green: 3, yellow: 3, red: 4 },
    );
  } finally {
    resetDefaultRepositories();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousContractVersion === undefined) {
      delete process.env.AI_ANALYTICS_CONTRACT_VERSION;
    } else {
      process.env.AI_ANALYTICS_CONTRACT_VERSION = previousContractVersion;
    }
  }
});

test('one below-threshold dynamic question locks the whole cross-service pipeline', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const fixture = dynamicFixtures[1];
  const enabledQuestions = fixture.definition.questions.filter(
    (candidate) => candidate.enabled,
  );
  const belowThresholdQuestion = enabledQuestions.at(-1)!;
  configureFixture(
    fixture,
    createResponses(
      fixture.roundId,
      enabledQuestions,
      10,
      belowThresholdQuestion.id,
    ),
  );

  try {
    const analytics = await fetchMcpAnalytics(fixture.roundId);
    assert.strictEqual(analytics.contractVersion, '3.0');
    assert.strictEqual(analytics.totalResponses, 10);
    assert.strictEqual(analytics.isLocked, true);
    assert.deepStrictEqual(analytics.dimensionScores, {});
    assert.deepStrictEqual(analytics.questionAggregates, {});

    const stoneMap = runPythonPipeline(analytics);
    assert.strictEqual(stoneMap.contractVersion, '3.0');
    assert.strictEqual(stoneMap.status, 'locked_error');
    assert.strictEqual(stoneMap.isLocked, true);
    assert.strictEqual(stoneMap.stones, undefined);
    assert.strictEqual(stoneMap.overallPsychologicalSummary, undefined);

    const callbackResponse = await postInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${fixture.roundId}/ai-insights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stoneMap),
        },
      ),
      { params: Promise.resolve({ roundId: fixture.roundId }) },
    );
    assert.strictEqual(callbackResponse.status, 200);
  } finally {
    resetDefaultRepositories();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
