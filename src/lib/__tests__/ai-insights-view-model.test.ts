import assert from 'node:assert';
import test from 'node:test';
import type { StoneDetail } from '../ai-contract';
import { applyStoneInsightToDimension } from '../ai-insights-view-model';
import { getDimensionById } from '../demo-data';

test('applyStoneInsightToDimension replaces demo analysis with AI content', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  const stone: StoneDetail = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'red',
    score: 40,
    psychologicalInterpretation: 'נדרש שינוי בעומס העבודה.',
    metrics: [{ label: 'ציון ממוצע', value: '40.0' }],
    recommendedInterventions: [
      {
        id: 'balance-1',
        dimensionId: 'balance',
        source: 'OECD',
        title: 'חלונות זמן מוגנים',
        summary: 'להגן על זמן הכנה.',
        actionable_steps: ['לקבוע שני חלונות בשבוע'],
      },
    ],
  };

  const result = applyStoneInsightToDimension(
    dimension,
    stone,
    'סיכום ארגוני',
  );

  assert.strictEqual(result.status, 'red');
  assert.strictEqual(result.score, 40);
  assert.deepStrictEqual(result.summary, ['נדרש שינוי בעומס העבודה.']);
  assert.strictEqual(result.metrics[0].value, '40.0');
  assert.match(result.recommendations[0].body, /שני חלונות/);
});
