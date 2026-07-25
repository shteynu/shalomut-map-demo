import assert from 'node:assert';
import test from 'node:test';
import type { StoneDetail } from '../ai-contract';
import { applyStoneInsightToDimension } from '../ai-insights-view-model';
import { getDimensionById } from '../demo-data';

test('applyStoneInsightToDimension keeps the round summary out of dimension detail copy', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  const interpretation =
    'ממוצעי שאלות האיזון מצביעים על קושי. זמן ההתאוששות הוא המדד הנמוך ביותר.';
  const stone: StoneDetail = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'red',
    score: 40,
    psychologicalInterpretation: interpretation,
    metrics: [],
    recommendedInterventions: [],
  };

  const result = applyStoneInsightToDimension(
    dimension,
    stone,
    'זהו סיכום כללי שמופיע פעם אחת בלבד במפת השלומות.',
  );

  assert.deepStrictEqual(result.summary, [interpretation]);
});
