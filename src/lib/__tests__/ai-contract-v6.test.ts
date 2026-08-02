import assert from 'node:assert';
import test from 'node:test';

import {
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_V6_CONTRACT_VERSION,
  validateStoneMapResult,
} from '../ai-contract';
import {
  SURVEY_DEFINITION_HASH,
  createValidV6Payload,
} from './fixtures/v6-payload';

test('accepts a complete Contract V6 Stone Map', () => {
  const payload = createValidV6Payload();
  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.strictEqual(AI_ANALYTICS_V6_CONTRACT_VERSION, '6.0');
  assert.deepStrictEqual(validation, { ok: true, value: payload });
});

test('requires exactly three dimension summary paragraphs', () => {
  const payload = createValidV6Payload();
  const dimensionId = AI_ANALYTICS_DIMENSION_IDS[0];
  payload.stones[dimensionId].summary.pop();

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.ok(!validation.ok);
  assert.match(validation.error, new RegExp(dimensionId, 'u'));
});

test('requires exactly five recommendations per dimension', () => {
  const payload = createValidV6Payload();
  const dimensionId = AI_ANALYTICS_DIMENSION_IDS[1];
  payload.stones[dimensionId].recommendedInterventions.pop();

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.ok(!validation.ok);
  assert.match(validation.error, new RegExp(dimensionId, 'u'));
});

test('rejects numeric or Latin text in a visible metric insight', () => {
  const validInsight = createValidV6Payload().stones[
    AI_ANALYTICS_DIMENSION_IDS[2]
  ].metrics[0].insightText;
  for (const insightText of [
    validInsight.replace('התשובות', 'התשובות עשרים%'),
    validInsight.replace('התשובות', 'medium התשובות'),
  ]) {
    const payload = createValidV6Payload();
    const dimensionId = AI_ANALYTICS_DIMENSION_IDS[2];
    payload.stones[dimensionId].metrics[0].insightText = insightText;

    const validation = validateStoneMapResult(payload, payload.roundId);

    assert.ok(!validation.ok, insightText);
    assert.match(validation.error, new RegExp(dimensionId, 'u'));
  }
});

test('accepts a privacy-locked V6 result without detailed analysis', () => {
  const payload = {
    contractVersion: AI_ANALYTICS_V6_CONTRACT_VERSION,
    roundId: 'round-v6-locked',
    surveyDefinitionHash: SURVEY_DEFINITION_HASH,
    isLocked: true,
    status: 'locked_error',
    errorMessage: 'התוצאות נעולות עד להגעה לסף הפרטיות.',
  };

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.deepStrictEqual(validation, { ok: true, value: payload });
});

test('does not accept the removed single psychologicalInterpretation field', () => {
  const payload = createValidV6Payload() as ReturnType<
    typeof createValidV6Payload
  > & {
    stones: Record<string, Record<string, unknown>>;
  };
  const dimensionId = AI_ANALYTICS_DIMENSION_IDS[3];
  payload.stones[dimensionId].psychologicalInterpretation =
    'זהו שדה ישן שאינו חלק מן החוזה החדש.';

  const validation = validateStoneMapResult(payload, payload.roundId);

  assert.ok(!validation.ok);
  assert.match(validation.error, new RegExp(dimensionId, 'u'));
});
