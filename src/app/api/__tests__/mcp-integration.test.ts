import assert from 'node:assert';
import test from 'node:test';
import { POST as mcpHandler } from '../mcp/route';
import { GET as getInsightsHandler, POST as postInsightsHandler } from '../rounds/[roundId]/ai-insights/route';
import { POST as triggerAiHandler } from '../rounds/[roundId]/trigger-ai/route';
import { getRepositories } from '@/lib/repositories';

const testRoundId = 'SHALOM-DEMO-ROUND-1';

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
  const mockPayload = {
    roundId: testRoundId,
    processedAt: new Date().toISOString(),
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary: 'Test summary from AI Microservice',
    stones: {
      workload_balance: {
        dimensionId: 'workload_balance',
        status: 'red',
        score: 42.5,
        psychologicalInterpretation: 'High stress level detected.',
      },
    },
  };

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

test('Trigger AI Webhook route produces valid trigger payload', async () => {
  const req = new Request(`http://localhost:3000/api/rounds/${testRoundId}/trigger-ai`, {
    method: 'POST',
  });

  const res = await triggerAiHandler(req, { params: Promise.resolve({ roundId: testRoundId }) });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'success');
  assert.strictEqual(data.webhookPayload.event, 'round_closed');
  assert.strictEqual(data.webhookPayload.roundId, testRoundId);
});
