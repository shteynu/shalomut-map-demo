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
