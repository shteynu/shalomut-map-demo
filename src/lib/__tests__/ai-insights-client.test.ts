import assert from 'node:assert';
import test from 'node:test';
import { AI_ANALYTICS_DIMENSION_IDS } from '../ai-contract';
import { loadAiInsights } from '../ai-insights-client';

function createStoneMap(roundId = 'round-ui') {
  return {
    contractVersion: '1.0',
    roundId,
    processedAt: '2026-07-24T12:00:00.000Z',
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary: 'סיכום',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => [
        dimensionId,
        {
          dimensionId,
          dimensionNameHebrew: dimensionId,
          status: dimensionId === 'balance' ? 'red' : 'green',
          score: dimensionId === 'balance' ? 40 : 80,
          psychologicalInterpretation: 'פירוש',
          recommendedInterventions: [],
          metrics: [],
        },
      ]),
    ),
  };
}

test('loadAiInsights returns a validated ready state', async () => {
  const result = await loadAiInsights(
    'round-ui',
    async () =>
      new Response(JSON.stringify(createStoneMap()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );

  assert.strictEqual(result.status, 'ready');
  if (result.status === 'ready') {
    assert.strictEqual(result.value.stones?.balance.status, 'red');
  }
});

test('loadAiInsights distinguishes not-found and locked states', async () => {
  const notFound = await loadAiInsights(
    'round-ui',
    async () => new Response(null, { status: 404 }),
  );
  assert.strictEqual(notFound.status, 'not-found');

  const neverDispatched = await loadAiInsights(
    'round-ui',
    async () =>
      new Response(
        JSON.stringify({
          error: 'AI insights not found for this round',
          roundId: 'round-ui',
          run: null,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
  );
  assert.strictEqual(neverDispatched.status, 'not-found');

  const locked = await loadAiInsights(
    'round-ui',
    async () =>
      new Response(
        JSON.stringify({
          contractVersion: '1.0',
          roundId: 'round-ui',
          isLocked: true,
          status: 'locked_error',
          errorMessage: 'Privacy lock active',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
  );
  assert.strictEqual(locked.status, 'locked');
});

test('a queued or running durable job is not reported as a missing analysis', async () => {
  const queued = await loadAiInsights(
    'round-ui',
    async () =>
      new Response(
        JSON.stringify({
          error: 'AI insights not found for this round',
          roundId: 'round-ui',
          run: { id: 'run-1', state: 'queued' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
  );
  const result = await loadAiInsights(
    'round-ui',
    async () =>
      new Response(
        JSON.stringify({
          error: 'AI insights not found for this round',
          roundId: 'round-ui',
          run: { id: 'run-1', state: 'running' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
  );

  assert.strictEqual(queued.status, 'running');
  assert.strictEqual(result.status, 'running');
});

test('a failed durable job is an error, not an empty round', async () => {
  const result = await loadAiInsights(
    'round-ui',
    async () =>
      new Response(
        JSON.stringify({
          error: 'AI insights not found for this round',
          roundId: 'round-ui',
          run: {
            id: 'run-1',
            state: 'failed',
            failureCode: 'worker_error',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
  );

  assert.strictEqual(result.status, 'error');
});

test('a failed analysis payload is surfaced as an error, never as a result', async () => {
  const result = await loadAiInsights(
    'round-ui',
    async () =>
      new Response(
        JSON.stringify({
          contractVersion: '5.0',
          roundId: 'round-ui',
          surveyDefinitionHash: `sha256:${'0'.repeat(64)}`,
          isLocked: false,
          status: 'validation_failed',
          failureReason: 'provider_unavailable',
          errorMessage: 'שירות הניתוח אינו זמין כרגע.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  );

  assert.strictEqual(result.status, 'error');
});

test('loadAiInsights rejects an invalid callback payload', async () => {
  const result = await loadAiInsights(
    'round-ui',
    async () =>
      new Response(JSON.stringify({ roundId: 'round-ui' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );

  assert.strictEqual(result.status, 'error');
});
