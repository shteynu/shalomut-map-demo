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
  SurveyResponseRecord,
} from '@/lib/types/backend';

const repositoryRoot = process.cwd();
const aiServiceRoot = path.join(repositoryRoot, 'ai-analytics-service');
const roundId = 'round_cross_service_e2e';

function createResponses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, responseIndex) => ({
    id: `response_${responseIndex}`,
    roundId,
    submittedAt: new Date('2026-07-24T12:00:00.000Z'),
    answers: surveyInstrument.questions.map((question) => {
      const value: AnswerValue =
        question.dimensionId === 'balance'
          ? 'red'
          : question.dimensionId === 'organizational-climate'
            ? 'yellow'
            : 'green';
      const score = value === 'green' ? 100 : value === 'yellow' ? 60 : 0;

      return {
        questionId: question.id,
        dimensionId: question.dimensionId,
        value,
        score,
      };
    }),
  }));
}

async function fetchMcpAnalytics() {
  const request = new Request('http://localhost:3000/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'e2e',
      method: 'tools/call',
      params: {
        name: 'get_round_analytics',
        arguments: { roundId },
      },
    }),
  });
  const response = await mcpHandler(request);
  assert.strictEqual(response.status, 200);
  const json = await response.json();
  return JSON.parse(json.result.content[0].text);
}

test('Core MCP -> Python graph -> callback persists a canonical Stone Map', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([
      {
        id: 'org_cross_service',
        name: 'בית ספר בדיקה',
        city: 'חיפה',
        schoolType: 'תיכון',
        totalStaffCount: 20,
        createdAt: new Date('2026-07-24T12:00:00.000Z'),
      },
    ]),
    roundRepo: new InMemoryRoundRepository([
      {
        id: roundId,
        organizationId: 'org_cross_service',
        title: 'Cross-service E2E',
        status: 'closed',
        shareCode: 'SHALOM-E2E',
        privacyThreshold: 10,
        startDate: new Date('2026-07-24T12:00:00.000Z'),
        createdAt: new Date('2026-07-24T12:00:00.000Z'),
      },
    ]),
    surveyRepo: new InMemorySurveyRepository(createResponses(10)),
  });

  try {
    const analytics = await fetchMcpAnalytics();
    assert.strictEqual(analytics.isLocked, false);
    assert.strictEqual(analytics.contractVersion, '2.0');
    assert.strictEqual(Object.keys(analytics.questionAggregates).length, 24);

    const python = spawnSync(
      'python3',
      ['-m', 'src.pipeline_cli'],
      {
        cwd: aiServiceRoot,
        input: JSON.stringify(analytics),
        encoding: 'utf8',
      },
    );
    assert.strictEqual(python.status, 0, python.stderr);
    const stoneMap = JSON.parse(python.stdout);

    const callbackRequest = new Request(
      `http://localhost:3000/api/rounds/${roundId}/ai-insights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stoneMap),
      },
    );
    const callbackResponse = await postInsightsHandler(callbackRequest, {
      params: Promise.resolve({ roundId }),
    });
    const callbackBody = await callbackResponse.clone().json();
    assert.strictEqual(
      callbackResponse.status,
      200,
      JSON.stringify(callbackBody),
    );

    const getResponse = await getInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${roundId}/ai-insights`,
      ),
      { params: Promise.resolve({ roundId }) },
    );
    assert.strictEqual(getResponse.status, 200);

    const persisted = await getResponse.json();
    assert.strictEqual(persisted.contractVersion, '2.0');
    assert.strictEqual(Object.keys(persisted.stones).length, 8);
    assert.strictEqual(persisted.stones.balance.status, 'red');
    assert.strictEqual(persisted.stones.balance.metrics.length, 3);
    assert.deepStrictEqual(
      persisted.stones.balance.generationProvenance.sourceQuestionIds,
      ['balance-1', 'balance-2', 'balance-3'],
    );
    assert.strictEqual(
      persisted.stones['organizational-climate'].status,
      'yellow',
    );
  } finally {
    resetDefaultRepositories();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});

test('Cross-service pipeline preserves the privacy lock below threshold', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  setRepositories({
    roundRepo: new InMemoryRoundRepository([
      {
        id: roundId,
        organizationId: 'org_cross_service',
        title: 'Locked cross-service E2E',
        status: 'closed',
        shareCode: 'SHALOM-E2E-LOCKED',
        privacyThreshold: 10,
        startDate: new Date('2026-07-24T12:00:00.000Z'),
        createdAt: new Date('2026-07-24T12:00:00.000Z'),
      },
    ]),
    surveyRepo: new InMemorySurveyRepository(createResponses(9)),
  });

  try {
    const analytics = await fetchMcpAnalytics();
    assert.strictEqual(analytics.isLocked, true);
    assert.strictEqual(analytics.contractVersion, '2.0');
    assert.deepStrictEqual(analytics.dimensionScores, {});
    assert.deepStrictEqual(analytics.questionAggregates, {});

    const python = spawnSync(
      'python3',
      ['-m', 'src.pipeline_cli'],
      {
        cwd: aiServiceRoot,
        input: JSON.stringify(analytics),
        encoding: 'utf8',
      },
    );
    assert.strictEqual(python.status, 0, python.stderr);
    const stoneMap = JSON.parse(python.stdout);
    assert.strictEqual(stoneMap.status, 'locked_error');
    assert.strictEqual(stoneMap.isLocked, true);
    assert.strictEqual(stoneMap.contractVersion, '2.0');
    assert.strictEqual(stoneMap.stones, undefined);

    const callbackResponse = await postInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${roundId}/ai-insights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stoneMap),
        },
      ),
      { params: Promise.resolve({ roundId }) },
    );
    assert.strictEqual(callbackResponse.status, 200);
  } finally {
    resetDefaultRepositories();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});
