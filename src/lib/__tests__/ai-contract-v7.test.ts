import assert from 'node:assert';
import test from 'node:test';

import {
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
  AI_ANALYTICS_V7_CONTRACT_VERSION,
  validateStoneMapResult,
} from '../ai-contract';
import { toDashboardInsights } from '../ai-insights-view-model';
import { createValidV7Payload } from './fixtures/v7-payload';

test('accepts a complete Contract V7 Stone Map', () => {
  const payload = createValidV7Payload();
  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.strictEqual(AI_ANALYTICS_V7_CONTRACT_VERSION, '7.0');
  assert.ok(AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS.includes('7.0'));
  assert.deepStrictEqual(validation, { ok: true, value: payload });
});

test('a V7 stone keeps the three paragraphs and the five recommendations of V6', () => {
  const fewerParagraphs = createValidV7Payload();
  fewerParagraphs.stones[AI_ANALYTICS_DIMENSION_IDS[0]].summary.pop();
  assert.ok(!validateStoneMapResult(fewerParagraphs, 'round-v7').ok);

  const fewerRecommendations = createValidV7Payload();
  fewerRecommendations.stones[AI_ANALYTICS_DIMENSION_IDS[1]]
    .recommendedInterventions.pop();
  assert.ok(!validateStoneMapResult(fewerRecommendations, 'round-v7').ok);
});

test('a V7 metric renders as Core-owned evidence, never as a narrative', () => {
  const payload = createValidV7Payload();
  const validation = validateStoneMapResult(payload, payload.roundId);
  assert.ok(validation.ok);

  const insights = toDashboardInsights(validation.value);
  for (const stone of Object.values(insights.stones)) {
    for (const metric of stone.metrics) {
      assert.strictEqual(metric.narrativeOnly, undefined);
      assert.ok(metric.value.length > 0, 'the average is the metric content');
      assert.ok(metric.distribution, 'the distribution is shown');
    }
    // The stone's copy is its overview, as on 6.0.
    assert.strictEqual(stone.summary.length, 3);
  }
});
