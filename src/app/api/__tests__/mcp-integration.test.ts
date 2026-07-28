import assert from 'node:assert';
import test, { after, before } from 'node:test';
import { POST as mcpHandler, dynamic as mcpDynamic } from '../mcp/route';
import { GET as getInsightsHandler, POST as postInsightsHandler } from '../rounds/[roundId]/ai-insights/route';
import { POST as triggerAiHandler } from '../rounds/[roundId]/trigger-ai/route';
import { AI_ANALYTICS_DIMENSION_IDS } from '@/lib/ai-contract';
import { surveyInstrument } from '@/lib/shalomut-source';
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
// A second round keeps the dispatch-failure test independent of the claim the
// success test leaves behind on `testRoundId`.
const triggerFailureRoundId = 'round_demo_trigger_failure';
let previousDatabaseUrl: string | undefined;

function installDefaultRepositories() {
  setRepositories({
    orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
    roundRepo: new InMemoryRoundRepository([
      DEMO_ROUND,
      { ...DEMO_ROUND, id: triggerFailureRoundId, shareCode: 'SHALOM-TRIGGER' },
    ]),
    surveyRepo: new InMemorySurveyRepository(),
  });
}

before(() => {
  previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  installDefaultRepositories();
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
    return JSON.parse(body.result.content[0].text);
  }

  try {
    // Locked round: no responses at all, so nothing may cross the boundary.
    setRepositories({
      orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
      roundRepo: new InMemoryRoundRepository([
        {
          ...DEMO_ROUND,
          id: contextRoundId,
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
    setRepositories({
      orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
      roundRepo: new InMemoryRoundRepository([
        {
          ...DEMO_ROUND,
          id: contextRoundId,
          shareCode: 'SHALOM-CONTEXT',
          privacyThreshold: 10,
          backgroundContext,
        },
      ]),
      // Ten answers, because that is what unlocks a round.
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
  const savedData = await getRes.json();
  assert.strictEqual(savedData.roundId, testRoundId);
  assert.strictEqual(savedData.overallPsychologicalSummary, 'Test summary from AI Microservice');
});

test('An empty AI result says whether a run was ever dispatched, is running, or died', async () => {
  const runStateRoundId = 'round_run_state';

  // A dispatch that happened long ago and left nothing behind: the run is over
  // one way or another, and no result is coming.
  class DeadRunRoundRepository extends InMemoryRoundRepository {
    public async getAiAnalysisDispatchedAt(): Promise<Date | null> {
      return new Date(Date.now() - 60 * 60_000);
    }
  }

  async function readRunState(roundRepo: InMemoryRoundRepository) {
    setRepositories({
      orgRepo: new InMemoryOrganizationRepository([DEMO_ORGANIZATION]),
      roundRepo,
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

  const round = { ...DEMO_ROUND, id: runStateRoundId, shareCode: 'SHALOM-RUNSTATE' };

  try {
    const neverDispatched = await readRunState(
      new InMemoryRoundRepository([round]),
    );
    assert.strictEqual(neverDispatched.state, 'idle');
    assert.strictEqual(neverDispatched.dispatchedAt, null);

    const inFlightRepo = new InMemoryRoundRepository([round]);
    assert.strictEqual(
      await inFlightRepo.claimAiAnalysisRun(runStateRoundId, { leaseMs: 0 }),
      true,
    );
    const inFlight = await readRunState(inFlightRepo);
    assert.strictEqual(inFlight.state, 'running');
    assert.ok(inFlight.dispatchedAt);

    const dead = await readRunState(new DeadRunRoundRepository([round]));
    assert.strictEqual(dead.state, 'stalled');
  } finally {
    installDefaultRepositories();
  }
});

test('AI Insights API keeps legacy 1.0 persistence independent from 3.0 questionnaire validation', async () => {
  const legacyRoundId = 'round_legacy_snapshot';
  setRepositories({
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

test('Trigger AI Webhook omits a dynamic callback target and returns accepted', async () => {
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
      Object.hasOwn(forwardedPayload ?? {}, 'callbackUrl'),
      false,
    );

    // The dispatch claim is still held, so an immediate second run is refused
    // instead of starting a duplicate provider run for the same round.
    const duplicate = await triggerAiHandler(req, {
      params: Promise.resolve({ roundId: testRoundId }),
    });
    assert.strictEqual(duplicate.status, 409);
    assert.strictEqual((await duplicate.json()).status, 'already_running');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Trigger AI Webhook exposes upstream and network failures', async () => {
  const originalFetch = globalThis.fetch;
  const req = new Request(
    `https://shalomut.example/api/rounds/${triggerFailureRoundId}/trigger-ai`,
    { method: 'POST' },
  );

  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'AI failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const upstreamFailure = await triggerAiHandler(req, {
      params: Promise.resolve({ roundId: triggerFailureRoundId }),
    });
    assert.strictEqual(upstreamFailure.status, 502);

    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;

    // A failed dispatch releases its claim, so this retry reaches the transport
    // again instead of being refused as a duplicate run.
    const networkFailure = await triggerAiHandler(req, {
      params: Promise.resolve({ roundId: triggerFailureRoundId }),
    });
    assert.strictEqual(networkFailure.status, 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the MCP route stays dynamic so it can read the Authorization header', () => {
  // Under `force-static` the deployed runtime hands the handler empty request
  // headers, so the shared-secret check rejects even a correct secret while
  // local development keeps passing.
  assert.strictEqual(mcpDynamic, 'force-dynamic');
});
