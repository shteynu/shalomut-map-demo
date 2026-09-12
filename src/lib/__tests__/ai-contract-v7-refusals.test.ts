import assert from 'node:assert';
import test from 'node:test';
import { validateStoneMapResult } from '../ai-contract';
import { createValidV7Payload } from './fixtures/v7-payload';

/**
 * One refusal per rule contract `7.0` adds or changes, in the form the other
 * versions' suites use: one valid payload, one broken thing per case, and the
 * accepting side wherever a rule has two.
 *
 * `7.0` shares 6.0's overview and recommendation rules, which
 * `ai-contract-v6-refusals.test.ts` pins through the same structured-stone
 * validator. What is `7.0`'s own is the metric: no narrative, a named scale
 * and a polarity, and no provenance for narratives that do not exist.
 */

const ROUND_ID = 'round-v7';

type Payload = ReturnType<typeof createValidV7Payload>;

function firstStone(payload: Payload): Record<string, any> {
  return payload.stones[Object.keys(payload.stones)[0]];
}

function refusal(mutate: (payload: Payload) => void): string {
  const payload = createValidV7Payload(ROUND_ID);
  mutate(payload);
  const result = validateStoneMapResult(payload, ROUND_ID);
  assert.strictEqual(
    result.ok,
    false,
    'the validator accepted a payload that breaks a 7.0 rule',
  );
  return result.ok === false ? result.error : '';
}

function accepts(message: string, mutate: (payload: Payload) => void): void {
  const payload = createValidV7Payload(ROUND_ID);
  mutate(payload);
  const result = validateStoneMapResult(payload, ROUND_ID);
  assert.strictEqual(result.ok, true, message);
}

test('the valid 7.0 fixture is accepted, so every refusal below is about its one change', () => {
  accepts('a valid 7.0 payload', () => {});
});

test('a 7.0 metric carries no narrative', () => {
  // The 6.0 field, with 6.0-valid content: refused for being there at all,
  // not for being malformed.
  const narrative = `${'הטקסט מתאר את המשמעות של התשובות ומציע התבוננות זהירה המבוססת רק על המידע שנאסף. '.repeat(4)}`.trim();
  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].insightText = narrative;
    }),
    /does not match AI analytics contract 7\.0/u,
  );
});

test('a 7.0 metric names the scale it was answered on', () => {
  assert.match(
    refusal((payload) => {
      delete firstStone(payload).metrics[0].scaleId;
    }),
    /does not match AI analytics contract 7\.0/u,
  );
  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].scaleId = '';
    }),
    /does not match AI analytics contract 7\.0/u,
  );
});

test('a 7.0 metric says which way it points, in one of two words', () => {
  assert.match(
    refusal((payload) => {
      delete firstStone(payload).metrics[0].polarity;
    }),
    /does not match AI analytics contract 7\.0/u,
  );
  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].polarity = 'reversed';
    }),
    /does not match AI analytics contract 7\.0/u,
  );
  accepts('positive is a polarity', (payload) => {
    firstStone(payload).metrics[0].polarity = 'positive';
  });
  accepts('negative is a polarity', (payload) => {
    firstStone(payload).metrics[0].polarity = 'negative';
  });
});

test('a 7.0 metric still echoes the distribution 5.0 introduced', () => {
  assert.match(
    refusal((payload) => {
      delete firstStone(payload).metrics[0].scoreDistribution;
    }),
    /does not match AI analytics contract 7\.0/u,
  );
});

test('7.0 provenance cannot say who wrote narratives it does not carry', () => {
  assert.match(
    refusal((payload) => {
      firstStone(payload).generationProvenance.metricInsightsOutcome = 'llm';
    }),
    /does not match AI analytics contract 7\.0/u,
  );
  // The round-level sibling still applies: 7.0 asks the model for the
  // opening sentence exactly as 6.0 does.
  accepts('overallSummaryOutcome is 6.0 and up', (payload) => {
    (payload as Record<string, unknown>).overallSummaryOutcome =
      'deterministic_fallback';
  });
});

test('a 7.0 stone may still be a declared gap', () => {
  accepts('an unavailable overview with an empty summary', (payload) => {
    const stone = firstStone(payload);
    stone.summary = [];
    stone.generationProvenance.outcome = 'unavailable';
    (payload as Record<string, unknown>).dimensionsWithoutInterpretation = [
      stone.dimensionId,
    ];
  });
});
