import assert from 'node:assert';
import test from 'node:test';
import type { StoneDetail } from '../ai-contract';
import {
  applyStoneInsightToDimension,
  getDimensionActionPresentation,
} from '../ai-insights-view-model';
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

test('applyStoneInsightToDimension exposes all three canonical question aggregates as UI metrics', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  const stone: StoneDetail = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'yellow',
    score: 61,
    psychologicalInterpretation:
      'ממוצעי השאלות מצביעים על מצב הדורש תשומת לב. זמן ההתאוששות נמוך יחסית לשאלות האחרות.',
    metrics: [
      {
        questionId: 'balance-1',
        label: 'אני מצליחה לבצע את משימות העבודה בזמן שנקבע.',
        value: 'ערך שלא אמור להחליף את הממוצע',
        averageScore: 72,
        responseCount: 14,
      },
      {
        questionId: 'balance-2',
        label: 'יש לי מספיק זמן למנוחה ולהתאוששות אחרי העבודה.',
        value: 'ערך שלא אמור להחליף את הממוצע',
        averageScore: 48.5,
        responseCount: 14,
        trend: 'המדד הנמוך בממד',
      },
      {
        questionId: 'balance-3',
        label: 'אני מרגישה שהעומס בעבודה מתאים לי והוא בהישג יד.',
        value: 'ערך שלא אמור להחליף את הממוצע',
        averageScore: 62.25,
        responseCount: 14,
      },
    ],
    recommendedInterventions: [],
  };

  const result = applyStoneInsightToDimension(dimension, stone);

  assert.strictEqual(result.metrics.length, 3);
  assert.deepStrictEqual(
    result.metrics.map((metric) => metric.label),
    stone.metrics.map((metric) => metric.label),
  );
  assert.deepStrictEqual(
    result.metrics.map((metric) => metric.value),
    ['72 מתוך 100', '48.5 מתוך 100', '62.25 מתוך 100'],
  );
  assert.deepStrictEqual(
    result.metrics.map((metric) => metric.helper),
    ['14 משיבים', '14 משיבים • המדד הנמוך בממד', '14 משיבים'],
  );
});

test('applyStoneInsightToDimension never uses an intervention from a different status', () => {
  const dimension = getDimensionById('balance');
  assert.ok(dimension);

  const stone: StoneDetail = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'red',
    score: 40,
    psychologicalInterpretation:
      'ממוצעי השאלות מצביעים על קושי. נדרשת תשומת לב לממצאים המצרפיים.',
    metrics: [],
    recommendedInterventions: [
      {
        id: 'balance-red',
        dimensionId: 'balance',
        status: 'red',
        source: 'catalog',
        title: 'פעולה תואמת',
        summary: 'מענה לסטטוס האדום.',
        actionable_steps: ['לקבוע זמן מוגן'],
      },
      {
        id: 'balance-green',
        dimensionId: 'balance',
        status: 'green',
        source: 'catalog',
        title: 'פעולה מסטטוס אחר',
        summary: 'אסור להציג את הפעולה הזו.',
        actionable_steps: ['לא להציג'],
      },
    ],
  };

  const result = applyStoneInsightToDimension(dimension, stone);

  assert.deepStrictEqual(
    result.recommendations.map((recommendation) => recommendation.title),
    ['פעולה תואמת'],
  );
});

test('green dimensions use preservation language without improvement goals', () => {
  assert.deepStrictEqual(getDimensionActionPresentation('green'), {
    dimensionTitle: 'חוזקה לשימור',
    actionsTitle: 'פעולות לשימור',
    actionItemLabel: 'פעולת שימור',
  });

  assert.deepStrictEqual(getDimensionActionPresentation('red'), {
    dimensionTitle: 'תמונת מצב',
    actionsTitle: 'מטרות ויעדים',
    actionItemLabel: 'יעד',
  });
});
