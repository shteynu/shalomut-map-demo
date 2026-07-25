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
import type { SurveyResponseRecord } from '@/lib/types/backend';

const unlockedRoundId = 'round_mcp_semantic_unlocked';
const lockedRoundId = 'round_mcp_semantic_locked';
let previousDatabaseUrl: string | undefined;
let previousMcpSecret: string | undefined;

function createResponses(count: number): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, responseIndex) => ({
    id: `response_${responseIndex}`,
    roundId: unlockedRoundId,
    submittedAt: new Date('2026-07-25T12:00:00.000Z'),
    anonymousTokenHash: `private-token-${responseIndex}`,
    answers: surveyInstrument.questions.map((question, questionIndex) => {
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

test('MCP exposes exactly 24 canonical privacy-safe question aggregates for an unlocked round', async () => {
  const payload = await fetchMcpAnalytics(unlockedRoundId);
  const questionAggregates = payload.questionAggregates as
    | Record<string, Record<string, unknown>>
    | undefined;

  assert.ok(
    questionAggregates,
    'unlocked MCP payload must expose questionAggregates',
  );
  assert.deepStrictEqual(
    Object.keys(questionAggregates).sort(),
    surveyInstrument.questions.map((question) => question.id).sort(),
  );

  for (const question of surveyInstrument.questions) {
    assert.strictEqual(
      questionAggregates[question.id].dimensionId,
      question.dimensionId,
    );
    assert.strictEqual(
      questionAggregates[question.id].questionTextHebrew,
      question.text,
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
