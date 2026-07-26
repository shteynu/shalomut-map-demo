import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { POST as mcpHandler } from '../mcp/route';
import {
  InMemoryRoundRepository,
  InMemorySurveyRepository,
  resetDefaultRepositories,
  setRepositories,
} from '@/lib/repositories';
import { surveyInstrument } from '@/lib/shalomut-source';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import { createSurveyDefinitionHash } from '@/lib/survey-definition-hash';
import type {
  SurveyDefinitionQuestion,
  SurveyResponseRecord,
} from '@/lib/types/backend';

const unlockedRoundId = 'round_mcp_semantic_unlocked';
const lockedRoundId = 'round_mcp_semantic_locked';
let previousDatabaseUrl: string | undefined;
let previousMcpSecret: string | undefined;

const dynamicQuestions: SurveyDefinitionQuestion[] = surveyInstrument.dimensions.map(
  (dimension, index) => ({
    id: `mcp-custom-${dimension.id}-${index + 1}`,
    dimensionId: dimension.id,
    text: `שאלת MCP מותאמת ${index + 1}`,
    required: true,
    enabled: true,
    answerMode: 'סקאלת צבעים',
  }),
);

function createResponses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, responseIndex) => ({
    id: `response_${responseIndex}`,
    roundId: unlockedRoundId,
    submittedAt: new Date('2026-07-25T12:00:00.000Z'),
    anonymousTokenHash: `private-token-${responseIndex}`,
    answers: dynamicQuestions.map((question, questionIndex) => {
      const score = questionIndex % 3 === 0 ? 100 : questionIndex % 3 === 1 ? 60 : 0;
      const value = score === 100 ? 'green' : score === 60 ? 'yellow' : 'red';

      return {
        questionId: question.id,
        dimensionId: question.dimensionId,
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
  const body = await response.json();
  return JSON.parse(body.result.content[0].text) as Record<string, unknown>;
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  previousMcpSecret = process.env.MCP_SHARED_SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.MCP_SHARED_SECRET;

  const definition = createCanonicalSurveyDefinition(
    'Dynamic MCP round',
    10,
  );
  definition.questions = dynamicQuestions;
  setRepositories({
    roundRepo: new InMemoryRoundRepository([
      {
        id: unlockedRoundId,
        organizationId: 'org_semantic',
        title: 'Unlocked semantic round',
        status: 'closed',
        shareCode: 'SEMANTIC-OPEN',
        privacyThreshold: 10,
        startDate: new Date('2026-07-25T12:00:00.000Z'),
        surveyDefinition: definition,
        createdAt: new Date('2026-07-25T12:00:00.000Z'),
      },
      {
        id: lockedRoundId,
        organizationId: 'org_semantic',
        title: 'Locked semantic round',
        status: 'closed',
        shareCode: 'SEMANTIC-LOCKED',
        privacyThreshold: 10,
        startDate: new Date('2026-07-25T12:00:00.000Z'),
        surveyDefinition: definition,
        createdAt: new Date('2026-07-25T12:00:00.000Z'),
      },
    ]),
    surveyRepo: new InMemorySurveyRepository(createResponses(10)),
  });
});

after(() => {
  resetDefaultRepositories();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousMcpSecret === undefined) delete process.env.MCP_SHARED_SECRET;
  else process.env.MCP_SHARED_SECRET = previousMcpSecret;
});

test('MCP exposes exact dynamic privacy-safe question aggregates for an unlocked round', async () => {
  const payload = await fetchMcpAnalytics(unlockedRoundId);
  const questionAggregates = payload.questionAggregates as
    | Record<string, Record<string, unknown>>
    | undefined;

  assert.strictEqual(payload.contractVersion, '3.0');
  assert.strictEqual(payload.organizationId, 'org_semantic');
  assert.strictEqual(
    payload.surveyDefinitionHash,
    createSurveyDefinitionHash(dynamicQuestions),
  );
  assert.ok(
    questionAggregates,
    'unlocked MCP payload must expose questionAggregates',
  );
  assert.deepStrictEqual(
    Object.keys(questionAggregates).sort(),
    dynamicQuestions.map((question) => question.id).sort(),
  );

  for (const question of dynamicQuestions) {
    assert.strictEqual(
      questionAggregates[question.id].dimensionId,
      question.dimensionId,
    );
    assert.strictEqual(
      questionAggregates[question.id].questionText,
      question.text,
    );
    assert.strictEqual(
      questionAggregates[question.id].responseCount,
      10,
    );
    assert.strictEqual(
      typeof questionAggregates[question.id].averageScore,
      'number',
    );
  }

  const serialized = JSON.stringify(payload);
  for (const privateField of [
    'answers',
    'anonymousTokenHash',
    'responseId',
    'submittedAt',
  ]) {
    assert.strictEqual(serialized.includes(privateField), false);
  }
  assert.strictEqual(Object.hasOwn(payload, 'organizationContext'), false);
});

test('MCP exposes empty aggregate maps for a privacy-locked round', async () => {
  const payload = await fetchMcpAnalytics(lockedRoundId);

  assert.deepStrictEqual(
    payload.dimensionScores,
    {},
    'locked MCP payload must not contain placeholder dimension scores',
  );
  assert.deepStrictEqual(
    payload.questionAggregates,
    {},
    'locked MCP payload must contain an explicit empty question aggregate map',
  );
});
