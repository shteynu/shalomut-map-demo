import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { POST as mcpHandler } from '../mcp/route';
import { GET as getInsightsHandler, POST as postInsightsHandler } from '../rounds/[roundId]/ai-insights/route';
import { POST as triggerAiHandler } from '../rounds/[roundId]/trigger-ai/route';
import { AI_ANALYTICS_DIMENSION_IDS } from '@/lib/ai-contract';
import {
  DEMO_ORGANIZATION,
  DEMO_ROUND,
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
  resetDefaultRepositories,
  setRepositories,
} from '@/lib/repositories';

const testRoundId = 'round_demo_1';
let previousDatabaseUrl: string | undefined;

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND]),
    surveyRepo: new InMemorySurveyRepository(),
  });
});

after(() => {
  resetDefaultRepositories();
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

function createValidInsightsPayload(roundId = testRoundId) {
  return {
    contractVersion: '1.0',
    roundId,
    processedAt: new Date().toISOString(),
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary: 'Test summary from AI Microservice',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => [
        dimensionId,
        {
          dimensionId,
          dimensionNameHebrew: dimensionId,
          status: 'yellow',
          score: 60,
          psychologicalInterpretation: 'High stress level detected.',
          recommendedInterventions: [],
          metrics: [],
        },
      ]),
    ),
  };
}

test('MCP Server returns list of tools for tools/list method', async () => {
  const req = new Request('http://localhost:3000/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'tools/list',
    }),
  });

  const res = await mcpHandler(req);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.jsonrpc, '2.0');
  assert.strictEqual(data.result.tools.length, 1);
  assert.strictEqual(data.result.tools[0].name, 'get_round_analytics');
});

test('MCP Server requires its shared secret when configured', async () => {
  const previousSecret = process.env.MCP_SHARED_SECRET;
  process.env.MCP_SHARED_SECRET = 'mcp-test-secret';

  try {
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'protected',
        method: 'tools/list',
      }),
    });

    const res = await mcpHandler(req);
    assert.strictEqual(res.status, 401);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.MCP_SHARED_SECRET;
    } else {
      process.env.MCP_SHARED_SECRET = previousSecret;
    }
  }
});

test('MCP Server fails closed on Vercel when its shared secret is missing', async () => {
  const previousSecret = process.env.MCP_SHARED_SECRET;
  const previousVercelEnvironment = process.env.VERCEL_ENV;
  delete process.env.MCP_SHARED_SECRET;
  process.env.VERCEL_ENV = 'preview';

  try {
    const req = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'missing-secret',
        method: 'tools/list',
      }),
    });

    const res = await mcpHandler(req);
    assert.strictEqual(res.status, 401);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.MCP_SHARED_SECRET;
    } else {
      process.env.MCP_SHARED_SECRET = previousSecret;
    }

    if (previousVercelEnvironment === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = previousVercelEnvironment;
    }
  }
});

test('MCP Server returns error for invalid tool call', async () => {
  const req = new Request('http://localhost:3000/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '2',
      method: 'tools/call',
      params: { name: 'non_existent_tool' },
    }),
  });

  const res = await mcpHandler(req);
  assert.strictEqual(res.status, 404);
  const data = await res.json();
  assert.strictEqual(data.error.code, -32601);
});

test('AI Insights API saves and retrieves Stone Map JSON payload', async () => {
  const mockPayload = createValidInsightsPayload();

  // Save insights via POST
  const postReq = new Request(`http://localhost:3000/api/rounds/${testRoundId}/ai-insights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mockPayload),
  });

  const postRes = await postInsightsHandler(postReq, { params: Promise.resolve({ roundId: testRoundId }) });
  assert.strictEqual(postRes.status, 200);

  // Retrieve insights via GET
  const getReq = new Request(`http://localhost:3000/api/rounds/${testRoundId}/ai-insights`, {
    method: 'GET',
  });

  const getRes = await getInsightsHandler(getReq, { params: Promise.resolve({ roundId: testRoundId }) });
  assert.strictEqual(getRes.status, 200);
  const savedData = await getRes.json();
  assert.strictEqual(savedData.roundId, testRoundId);
  assert.strictEqual(savedData.overallPsychologicalSummary, 'Test summary from AI Microservice');
});

test('AI Insights API rejects a legacy Stone Map contract', async () => {
  const legacyPayload = {
    ...createValidInsightsPayload(),
    stones: {
      workload_balance: {
        dimensionId: 'workload_balance',
        dimensionNameHebrew: 'איזון עומס עבודה',
        status: 'red',
        score: 42.5,
        psychologicalInterpretation: 'Legacy payload',
        recommendedInterventions: [],
        metrics: [],
      },
    },
  };
  const request = new Request(
    `http://localhost:3000/api/rounds/${testRoundId}/ai-insights`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacyPayload),
    },
  );

  const response = await postInsightsHandler(request, {
    params: Promise.resolve({ roundId: testRoundId }),
  });

  assert.strictEqual(response.status, 400);
});

test('AI Insights API rejects insights for an unknown round', async () => {
  const unknownRoundId = 'round_missing';
  const request = new Request(
    `http://localhost:3000/api/rounds/${unknownRoundId}/ai-insights`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createValidInsightsPayload(unknownRoundId)),
    },
  );

  const response = await postInsightsHandler(request, {
    params: Promise.resolve({ roundId: unknownRoundId }),
  });

  assert.strictEqual(response.status, 404);
});

test('AI Insights callback requires its shared secret when configured', async () => {
  const previousSecret = process.env.AI_CALLBACK_SECRET;
  process.env.AI_CALLBACK_SECRET = 'callback-test-secret';

  try {
    const request = new Request(
      `http://localhost:3000/api/rounds/${testRoundId}/ai-insights`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createValidInsightsPayload()),
      },
    );

    const response = await postInsightsHandler(request, {
      params: Promise.resolve({ roundId: testRoundId }),
    });

    assert.strictEqual(response.status, 401);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.AI_CALLBACK_SECRET;
    } else {
      process.env.AI_CALLBACK_SECRET = previousSecret;
    }
  }
});

test('Trigger AI Webhook uses the public request origin and returns accepted', async () => {
  const originalFetch = globalThis.fetch;
  let forwardedPayload: Record<string, unknown> | undefined;

  globalThis.fetch = (async (_input, init) => {
    forwardedPayload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ status: 'accepted' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const req = new Request(
      `https://shalomut.example/api/rounds/${testRoundId}/trigger-ai`,
      { method: 'POST' },
    );

    const res = await triggerAiHandler(req, {
      params: Promise.resolve({ roundId: testRoundId }),
    });
    assert.strictEqual(res.status, 202);
    const data = await res.json();
    assert.strictEqual(data.status, 'accepted');
    assert.strictEqual(data.webhookPayload.event, 'round_closed');
    assert.strictEqual(data.webhookPayload.roundId, testRoundId);
    assert.strictEqual(
      forwardedPayload?.callbackUrl,
      `https://shalomut.example/api/rounds/${testRoundId}/ai-insights`,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Trigger AI Webhook exposes upstream and network failures', async () => {
  const originalFetch = globalThis.fetch;
  const req = new Request(
    `https://shalomut.example/api/rounds/${testRoundId}/trigger-ai`,
    { method: 'POST' },
  );

  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'AI failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const upstreamFailure = await triggerAiHandler(req, {
      params: Promise.resolve({ roundId: testRoundId }),
    });
    assert.strictEqual(upstreamFailure.status, 502);

    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;

    const networkFailure = await triggerAiHandler(req, {
      params: Promise.resolve({ roundId: testRoundId }),
    });
    assert.strictEqual(networkFailure.status, 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
