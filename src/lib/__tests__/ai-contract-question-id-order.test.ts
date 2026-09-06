import assert from 'node:assert';
import test from 'node:test';
import { validateStoneMapResult } from '../ai-contract';
import { createValidV3Payload } from './fixtures/legacy-payloads';
import { createValidV5Payload } from './fixtures/v5-payload';

/**
 * The question IDs a stone reports are a set, and a set has no order.
 *
 * Every provenance validator sorts both sides before comparing them, precisely
 * so that a provider listing the same questions in a different sequence is
 * still accepted. Contract `2.0` had that pinned — the reordering case at the
 * end of its provenance test in `ai-contract-legacy-refusals.test.ts` — and
 * `3.0` and `5.0` did not: every fixture of theirs happened to build its
 * metrics and its `sourceQuestionIds` in the same already-sorted order. The
 * mutation run of 2026-09-06 reported the consequence as three survivors that
 * delete a `.sort()` from `isValidV3GenerationProvenance` and
 * `isValidV5GenerationProvenance` with the whole suite still green. A payload
 * arriving in another order would then have been refused, and the refusal would
 * have been correct according to the tests.
 *
 * Each case starts from a valid payload and reorders nothing but the sequence —
 * the same questions, the same metrics, the same provenance.
 *
 * `6.0` needs no case of its own: it travels the same `5.0` provenance
 * validator, and its fixture carries one metric per stone, where an order
 * cannot be expressed at all.
 */

type Stone = Record<string, any>;
type Payload = { stones: Record<string, Stone> };

function reverseQuestionOrder(payload: Payload): void {
  for (const stone of Object.values(payload.stones)) {
    stone.metrics = [...stone.metrics].reverse();
    stone.generationProvenance.sourceQuestionIds = [
      ...stone.generationProvenance.sourceQuestionIds,
    ].reverse();
  }
}

function assertAccepted(payload: unknown, roundId: string): void {
  const result = validateStoneMapResult(payload, roundId);
  assert.strictEqual(
    result.ok,
    true,
    `the validator refused a payload that only reordered question IDs: ${
      result.ok ? '' : result.error
    }`,
  );
}

test('3.0 accepts metrics and provenance that both arrive in another order', () => {
  const payload = createValidV3Payload() as unknown as Payload;
  reverseQuestionOrder(payload);

  assertAccepted(payload, 'round-v3');
});

test('5.0 accepts metrics and provenance that both arrive in another order', () => {
  const payload = createValidV5Payload() as unknown as Payload;
  reverseQuestionOrder(payload);

  assertAccepted(payload, 'round-v5');
});
