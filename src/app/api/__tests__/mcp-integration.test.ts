import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { POST as mcpHandler, dynamic as mcpDynamic } from '../mcp/route';
import { GET as getInsightsHandler, POST as postInsightsHandler } from '../rounds/[roundId]/ai-insights/route';
import { POST as triggerAiHandler } from '../rounds/[roundId]/trigger-ai/route';
import { AI_ANALYTICS_DIMENSION_IDS } from '@/lib/ai-contract';
import { surveyInstrument } from '@/lib/shalomut-source';
import {
  InMemoryAiAnalysisRunRepository,
  InMemoryOrganizationRepository,
  InMemoryRoundRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import { overrideCoreRepositories, resetCoreRepositories } from '@/lib/composition-root';
import { MINIMUM_PRIVACY_THRESHOLD } from '@/lib/survey-definition';
import { DEMO_ORGANIZATION, DEMO_ROUND } from '@/lib/repositories/__fixtures__/demo-records';

const testRoundId = 'round_demo_1';
// A second round keeps the dispatch-failure test independent of the claim the
// success test leaves behind on `testRoundId`.
const triggerFailureRoundId = 'round_demo_trigger_failure';
let previousDatabaseUrl: string | undefined;
let aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();

/**
 * Enough responses for a round to be analysable at all.
 *
 * These suites are about the durable queue and the callback, and they used to
 * run against a round with no responses whatever — which the product now
 * refuses, because dispatching the aggregates of a round below its privacy
 * threshold is the thing the threshold exists to prevent. Only the count is
 * load-bearing here, so the answers stay empty; a response carrying invented
 * answers would suggest the queue reads them.
 */
function analysableResponses(roundId: string) {
  return Array.from({ length: MINIMUM_PRIVACY_THRESHOLD }, (_unused, index) => ({
    id: `${roundId}-response-${index}`,
    roundId,
    answers: [],
    submittedAt: new Date('2026-08-17T09:00:00.000Z'),
  }));
}

function installDefaultRepositories() {
  aiAnalysisRunRepo = new InMemoryAiAnalysisRunRepository();
  overrideCoreRepositories({
    aiAnalysisRunRepo,
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    // Closed, because re-running an analysis is what this route is for since
    // 2026-08-17: closing a round is what asks for the first one.
    roundRepo: new InMemoryRoundRepository([
      { ...DEMO_ROUND, status: 'closed' },
      {
        ...DEMO_ROUND,
        id: triggerFailureRoundId,
        shareCode: 'SHALOM-TRIGGER',
        status: 'closed',
      },
    ]),
    surveyRepo: new InMemorySurveyRepository([
      ...analysableResponses(testRoundId),
      ...analysableResponses(triggerFailureRoundId),
    ]),
  });
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  installDefaultRepositories();
});

after(() => {
  resetCoreRepositories();
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
  assert.deepStrictEqual(
    data.result.tools[0].outputSchema.required,
    [
      'contractVersion',
      'roundId',
      'totalResponses',
      'privacyThreshold',
      'isLocked',
      'dimensionScores',
      'questionAggregates',
      'calculatedAt',
    ],
  );
  assert.strictEqual(
    data.result.tools[0].outputSchema.properties.isLocked.type,
    'boolean',
  );
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

test('MCP payload carries the school background context on 4.0 only, never when locked', async () => {
  const contextRoundId = 'round_with_background_context';
  const previousContractVersion = process.env.AI_ANALYTICS_CONTRACT_VERSION;

  const backgroundContext = {
    notes: 'שני מורים חדשים החלו החודש.',
    audience: 'all-staff',
    sicknessDaysThisQuarter: 12,
    newStaffMembers: 2,
    studentCount: 420,
    socioEconomicIndex: 5,
    classesPerGrade: { א: 2 },
  };

  async function readMcpPayload() {
    const res = await mcpHandler(
      new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'context',
          method: 'tools/call',
          params: {
            name: 'get_round_analytics',
            arguments: { roundId: contextRoundId },
          },
        }),
      }),
    );
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    const textPayload = JSON.parse(body.result.content[0].text);
    assert.deepStrictEqual(body.result.structuredContent, textPayload);
    assert.strictEqual(
      body.result.content[0].structuredContent,
      undefined,
      'structuredContent belongs to CallToolResult, not TextContent',
    );
    return body.result.structuredContent;
  }

  try {
    // Locked round: no responses at all, so nothing may cross the boundary.
    // Closed, so that the threshold is what withholds it — the AI service is
    // only ever asked about a round that has stopped collecting anyway, since
    // closing is what dispatches the analysis (ADR-016).
    overrideCoreRepositories({
      orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
      roundRepo: new InMemoryRoundRepository([
        {
          ...DEMO_ROUND,
          id: contextRoundId,
          status: 'closed',
          shareCode: 'SHALOM-CONTEXT',
          privacyThreshold: 10,
          backgroundContext,
        },
      ]),
      surveyRepo: new InMemorySurveyRepository(),
    });

    process.env.AI_ANALYTICS_CONTRACT_VERSION = '4.0';
    const locked = await readMcpPayload();
    assert.strictEqual(locked.isLocked, true);
    assert.strictEqual(locked.backgroundContext, undefined);

    // Unlocked round on 3.0 keeps the immutable 3.0 semantics: no context.
    overrideCoreRepositories({
      orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
      roundRepo: new InMemoryRoundRepository([
        {
          ...DEMO_ROUND,
          id: contextRoundId,
          status: 'closed',
          shareCode: 'SHALOM-CONTEXT',
          privacyThreshold: 10,
          backgroundContext,
        },
      ]),
      // Ten answers on a closed round, which is what unlocks one.
      surveyRepo: new InMemorySurveyRepository(
        Array.from({ length: 10 }, (_, index) => ({
          id: `response-context-${index + 1}`,
          roundId: contextRoundId,
          submittedAt: new Date(),
          answers: surveyInstrument.questions.map((question) => ({
            questionId: question.id,
            dimensionId: question.dimensionId,
            value: 'green' as const,
            score: 100 as const,
          })),
        })),
      ),
    });

    process.env.AI_ANALYTICS_CONTRACT_VERSION = '3.0';
    const legacy = await readMcpPayload();
    assert.strictEqual(legacy.contractVersion, '3.0');
    assert.strictEqual(legacy.isLocked, false);
    assert.strictEqual(legacy.backgroundContext, undefined);

    process.env.AI_ANALYTICS_CONTRACT_VERSION = '4.0';
    const enriched = await readMcpPayload();
    assert.strictEqual(enriched.contractVersion, '4.0');
    assert.strictEqual(enriched.isLocked, false);
    assert.strictEqual(enriched.backgroundContext.newStaffMembers, 2);
  } finally {
    if (previousContractVersion === undefined) {
      delete process.env.AI_ANALYTICS_CONTRACT_VERSION;
    } else {
      process.env.AI_ANALYTICS_CONTRACT_VERSION = previousContractVersion;
    }
    installDefaultRepositories();
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
  // The map arrives under `result`; `run` beside it says what the round's
  // newest analysis run is doing to that map.
  const savedData = (await getRes.json()).result;
  assert.strictEqual(savedData.roundId, testRoundId);
  assert.strictEqual(savedData.overallPsychologicalSummary, 'Test summary from AI Microservice');
});

test('AI Insights callback completes the leased run idempotently and rejects stale ownership', async () => {
  installDefaultRepositories();
  const enqueued = await aiAnalysisRunRepo.enqueue(testRoundId, {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  const lease = await aiAnalysisRunRepo.claimNext({
    workerId: 'callback-worker',
    leaseMs: 60_000,
  });
  assert.ok(lease);
  assert.strictEqual(lease.run.id, enqueued.run.id);

  const callbackUrl = new URL(
    `http://localhost:3000/api/rounds/${testRoundId}/ai-insights`,
  );
  const payload = createValidInsightsPayload();
  const callbackHeaders = {
    'Content-Type': 'application/json',
    'x-ai-analysis-run-id': lease.run.id,
    'x-ai-analysis-lease-token': lease.leaseToken,
  };

  const first = await postInsightsHandler(
    new Request(callbackUrl, {
      method: 'POST',
      headers: callbackHeaders,
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ roundId: testRoundId }) },
  );
  assert.strictEqual(first.status, 200);
  assert.strictEqual((await first.json()).duplicate, false);
  assert.strictEqual((await aiAnalysisRunRepo.findById(lease.run.id))?.state, 'succeeded');

  const duplicate = await postInsightsHandler(
    new Request(callbackUrl, {
      method: 'POST',
      headers: callbackHeaders,
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ roundId: testRoundId }) },
  );
  assert.strictEqual(duplicate.status, 200);
  assert.strictEqual((await duplicate.json()).duplicate, true);

  const stale = await postInsightsHandler(
    new Request(callbackUrl, {
      method: 'POST',
      headers: {
        ...callbackHeaders,
        'x-ai-analysis-lease-token':
          '00000000-0000-4000-8000-000000000000',
      },
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ roundId: testRoundId }) },
  );
  assert.strictEqual(stale.status, 409);
});

test('AI Insights callback verifies run ownership before it can fail a durable run', async () => {
  const otherRound = {
    ...DEMO_ROUND,
    id: 'round_callback_other',
    shareCode: 'SHALOM-CALLBACK-OTHER',
  };
  const protectedRunRepo = new InMemoryAiAnalysisRunRepository();
  overrideCoreRepositories({
    aiAnalysisRunRepo: protectedRunRepo,
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([DEMO_ROUND, otherRound]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const enqueued = await protectedRunRepo.enqueue(otherRound.id, {
      requestKey: 'automatic',
      trigger: 'automatic',
    });
    const lease = await protectedRunRepo.claimNext({
      workerId: 'callback-worker',
      leaseMs: 60_000,
    });
    assert.ok(lease);

    const callbackUrl = new URL(
      `http://localhost:3000/api/rounds/${testRoundId}/ai-insights`,
    );
    const response = await postInsightsHandler(
      new Request(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-analysis-run-id': enqueued.run.id,
          'x-ai-analysis-lease-token': lease.leaseToken,
        },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ roundId: testRoundId }) },
    );

    assert.strictEqual(response.status, 409);
    assert.strictEqual(
      (await protectedRunRepo.findById(enqueued.run.id))?.state,
      'running',
      'a callback routed to another round cannot mutate this run',
    );
  } finally {
    installDefaultRepositories();
  }
});

test('An empty AI result reports the durable queued, running, and failed lifecycle', async () => {
  const runStateRoundId = 'round_run_state';
  const round = { ...DEMO_ROUND, id: runStateRoundId, shareCode: 'SHALOM-RUNSTATE' };

  async function readRunState(runRepo: InMemoryAiAnalysisRunRepository) {
    overrideCoreRepositories({
      aiAnalysisRunRepo: runRepo,
      orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
      roundRepo: new InMemoryRoundRepository([round]),
      surveyRepo: new InMemorySurveyRepository(),
    });

    const response = await getInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${runStateRoundId}/ai-insights`,
        { method: 'GET' },
      ),
      { params: Promise.resolve({ roundId: runStateRoundId }) },
    );

    assert.strictEqual(response.status, 404);
    return (await response.json()).run;
  }

  try {
    const neverQueued = await readRunState(new InMemoryAiAnalysisRunRepository());
    assert.strictEqual(neverQueued, null);

    const queuedRepo = new InMemoryAiAnalysisRunRepository();
    await queuedRepo.enqueue(runStateRoundId, {
      requestKey: 'automatic',
      trigger: 'automatic',
    });
    const queued = await readRunState(queuedRepo);
    assert.strictEqual(queued.state, 'queued');

    const lease = await queuedRepo.claimNext({
      workerId: 'state-worker',
      leaseMs: 60_000,
    });
    assert.ok(lease);
    const inFlight = await readRunState(queuedRepo);
    assert.strictEqual(inFlight.state, 'running');
    assert.strictEqual(inFlight.attemptCount, 1);

    await queuedRepo.finish(lease.run.id, {
      state: 'failed',
      failureCode: 'worker_error',
      leaseToken: lease.leaseToken,
    });
    const failed = await readRunState(queuedRepo);
    assert.strictEqual(failed.state, 'failed');
    assert.strictEqual(failed.failureCode, 'worker_error');
  } finally {
    installDefaultRepositories();
  }
});

test('AI Insights API keeps legacy 1.0 persistence independent from 3.0 questionnaire validation', async () => {
  const legacyRoundId = 'round_legacy_snapshot';
  overrideCoreRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([
      {
        ...DEMO_ROUND,
        id: legacyRoundId,
        surveyDefinition: {
          ...DEMO_ROUND.surveyDefinition!,
          questions: [],
        },
      },
    ]),
    surveyRepo: new InMemorySurveyRepository(),
  });

  try {
    const response = await postInsightsHandler(
      new Request(
        `http://localhost:3000/api/rounds/${legacyRoundId}/ai-insights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createValidInsightsPayload(legacyRoundId)),
        },
      ),
      { params: Promise.resolve({ roundId: legacyRoundId }) },
    );

    assert.strictEqual(response.status, 200);
  } finally {
    installDefaultRepositories();
  }
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

test('Trigger AI durably queues one manager run without contacting the provider', async () => {
  installDefaultRepositories();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error('the request path must only enqueue durable work');
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
    assert.strictEqual(data.status, 'queued');
    assert.strictEqual(data.run.state, 'queued');
    assert.strictEqual(data.run.roundId, testRoundId);
    assert.strictEqual(fetchCalls, 0);
    assert.strictEqual(
      (await aiAnalysisRunRepo.findLatestByRoundId(testRoundId))?.id,
      data.run.id,
    );

    // The durable active-run constraint rejects a manager double click.
    const duplicate = await triggerAiHandler(req, {
      params: Promise.resolve({ roundId: testRoundId }),
    });
    assert.strictEqual(duplicate.status, 409);
    assert.strictEqual((await duplicate.json()).status, 'already_running');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Trigger AI creates a new manager run after the prior run reaches a terminal state', async () => {
  installDefaultRepositories();
  const req = new Request(
    `https://shalomut.example/api/rounds/${triggerFailureRoundId}/trigger-ai`,
    { method: 'POST' },
  );

  const firstResponse = await triggerAiHandler(req, {
    params: Promise.resolve({ roundId: triggerFailureRoundId }),
  });
  assert.strictEqual(firstResponse.status, 202);
  const firstRun = (await firstResponse.json()).run;
  const lease = await aiAnalysisRunRepo.claimNext({
    workerId: 'test-worker',
    leaseMs: 60_000,
  });
  assert.strictEqual(lease?.run.id, firstRun.id);
  assert.ok(lease);
  assert.strictEqual(
    await aiAnalysisRunRepo.finish(firstRun.id, {
      state: 'failed',
      failureCode: 'provider_error',
      leaseToken: lease.leaseToken,
    }),
    'transitioned',
  );

  const retry = await triggerAiHandler(req, {
    params: Promise.resolve({ roundId: triggerFailureRoundId }),
  });
  assert.strictEqual(retry.status, 202);
  assert.notStrictEqual((await retry.json()).run.id, firstRun.id);
});

test('the MCP route stays dynamic so it can read the Authorization header', () => {
  // Under `force-static` the deployed runtime hands the handler empty request
  // headers, so the shared-secret check rejects even a correct secret while
  // local development keeps passing.
  assert.strictEqual(mcpDynamic, 'force-dynamic');
});
