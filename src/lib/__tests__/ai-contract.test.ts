import assert from 'node:assert';
import test from 'node:test';
import {
  AI_ANALYTICS_CONTRACT_VERSION,
  AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_QUESTIONS,
  AI_ANALYTICS_QUESTION_IDS,
  AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
  AI_ANALYTICS_V1_CONTRACT_VERSION,
  validateStoneMapResult,
} from '../ai-contract';
import { surveyInstrument } from '../shalomut-source';

function createValidStoneMap(roundId = 'round-contract-test') {
  return {
    contractVersion: '1.0',
    roundId,
    processedAt: '2026-07-24T12:00:00.000Z',
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary: 'סיכום ארגוני',
    stones: Object.fromEntries(
      AI_ANALYTICS_DIMENSION_IDS.map((dimensionId) => [
        dimensionId,
        {
          dimensionId,
          dimensionNameHebrew: dimensionId,
          status: 'yellow',
          score: 60,
          psychologicalInterpretation: 'פירוש',
          recommendedInterventions: [],
          metrics: [],
        },
      ]),
    ),
  };
}

test('AI analytics contract uses the canonical survey dimension IDs', () => {
  assert.deepStrictEqual(
    AI_ANALYTICS_DIMENSION_IDS,
    surveyInstrument.dimensions.map((dimension) => dimension.id),
  );
  assert.deepStrictEqual(
    AI_ANALYTICS_QUESTION_IDS,
    surveyInstrument.questions.map((question) => question.id),
  );
  assert.deepStrictEqual(
    AI_ANALYTICS_QUESTIONS,
    surveyInstrument.questions.map((question) => ({
      id: question.id,
      dimensionId: question.dimensionId,
      textHebrew: question.text,
    })),
  );
  assert.strictEqual(AI_ANALYTICS_V1_CONTRACT_VERSION, '1.0');
  assert.strictEqual(AI_ANALYTICS_CONTRACT_VERSION, '2.0');
  assert.strictEqual(AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION, '3.0');
  assert.deepStrictEqual(AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS, [
    '1.0',
    '2.0',
    '3.0',
  ]);
});

test('validateStoneMapResult accepts a complete canonical Stone Map', () => {
  const result = validateStoneMapResult(
    createValidStoneMap(),
    'round-contract-test',
  );

  assert.strictEqual(result.ok, true);
});

test('contract 1.0 keeps its deployed structural semantics', () => {
  const legacyPayload = createValidStoneMap();
  legacyPayload.stones.balance.psychologicalInterpretation =
    'Legacy Latin structural copy remains accepted.';

  const result = validateStoneMapResult(legacyPayload, 'round-contract-test');

  assert.strictEqual(result.ok, true);
});

test('validateStoneMapResult rejects legacy or incomplete dimension IDs', () => {
  const payload = createValidStoneMap();
  const legacyStones: Record<string, unknown> = { ...payload.stones };
  delete legacyStones.balance;
  legacyStones.workload_balance = {
    ...payload.stones['self-expression'],
    dimensionId: 'workload_balance',
  };

  const result = validateStoneMapResult(
    { ...payload, stones: legacyStones },
    'round-contract-test',
  );

  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /canonical dimensions/i);
  }
});

test('validateStoneMapResult rejects a payload for a different round', () => {
  const result = validateStoneMapResult(
    createValidStoneMap('round-other'),
    'round-contract-test',
  );

  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /roundId/i);
  }
});
