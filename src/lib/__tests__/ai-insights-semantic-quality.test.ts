import assert from 'node:assert';
import test from 'node:test';
import type { StoneDetail, StoneMapResult } from '../ai-contract';
import {
  getDimensionActionPresentation,
  toDashboardInsights,
  toDashboardStone,
} from '../ai-insights-view-model';
import { DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION } from '../ai-contract-version';

test('the round summary stays out of dimension detail copy', () => {
  const interpretation =
    'ממוצעי שאלות האיזון מצביעים על קושי. זמן ההתאוששות הוא המדד הנמוך ביותר.';
  const overallSummary =
    'זהו סיכום כללי שמופיע פעם אחת בלבד במפת השלומות.';
  const stone: StoneDetail = {
    dimensionId: 'balance',
    dimensionNameHebrew: 'איזון',
    status: 'red',
    score: 40,
    psychologicalInterpretation: interpretation,
    metrics: [],
    recommendedInterventions: [],
  };
  const result: StoneMapResult = {
    contractVersion: DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION,
    roundId: 'round-summary',
    isLocked: false,
    status: 'success',
    overallPsychologicalSummary: overallSummary,
    stones: { balance: stone } as StoneMapResult['stones'],
  };

  // The DTO gives the round summary exactly one home. The stone mapper no
  // longer even receives it, so it cannot leak into a dimension's paragraphs.
  const insights = toDashboardInsights(result);

  assert.strictEqual(insights.overallSummary, overallSummary);
  assert.deepStrictEqual(insights.stones.balance?.summary, [interpretation]);
});

test('the mapper exposes all three canonical question aggregates as UI metrics', () => {
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

  const result = toDashboardStone(stone);

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

test('the mapper preserves exact dynamic question text and variable metric counts across rounds', () => {
  const roundFixtures = [
    {
      roundId: 'round-short',
      metrics: [
        {
          questionId: 'short-balance-energy',
          label: 'בסוף יום העבודה נשארת לי אנרגיה לחיים שמחוץ לבית הספר.',
          value: 'ערך מחושב',
          averageScore: 67.5,
          responseCount: 12,
        },
        {
          questionId: 'short-balance-recovery',
          label: 'יש לי מרחב קבוע להתאוששות בין ימי עבודה עמוסים.',
          value: 'ערך מחושב',
          averageScore: 54,
          responseCount: 12,
        },
      ],
    },
    {
      roundId: 'round-expanded',
      metrics: [
        {
          questionId: 'expanded-balance-boundaries',
          label: 'גבולות יום העבודה ברורים לי ונשמרים ברוב השבוע.',
          value: 'ערך מחושב',
          averageScore: 71,
          responseCount: 18,
        },
        {
          questionId: 'expanded-balance-breaks',
          label: 'אני מצליחה לקחת הפסקות שמאפשרות לי לחזור מרוכזת.',
          value: 'ערך מחושב',
          averageScore: 63.25,
          responseCount: 18,
        },
        {
          questionId: 'expanded-balance-planning',
          label: 'תכנון השבוע משאיר לי זמן סביר למשימות בלתי צפויות.',
          value: 'ערך מחושב',
          averageScore: 58,
          responseCount: 18,
        },
        {
          questionId: 'expanded-balance-home',
          label: 'העבודה מאפשרת לי להיות פנויה גם לצרכים בבית.',
          value: 'ערך מחושב',
          averageScore: 61,
          responseCount: 18,
        },
      ],
    },
  ];

  for (const fixture of roundFixtures) {
    const stone: StoneDetail = {
      dimensionId: 'balance',
      dimensionNameHebrew: 'איזון',
      status: 'yellow',
      score: 62,
      psychologicalInterpretation:
        'הממצאים מצביעים על איזון חלקי בשגרת העבודה. ניכרת שונות בין מקורות העומס וההתאוששות.',
      metrics: fixture.metrics,
      recommendedInterventions: [],
    };

    const result = toDashboardStone(stone);

    assert.strictEqual(result.metrics.length, fixture.metrics.length, fixture.roundId);
    assert.deepStrictEqual(
      result.metrics.map((metric) => metric.label),
      fixture.metrics.map((metric) => metric.label),
      fixture.roundId,
    );
    assert.deepStrictEqual(
      result.metrics.map((metric) => metric.value),
      fixture.metrics.map((metric) => `${metric.averageScore} מתוך 100`),
      fixture.roundId,
    );
  }
});

test('the mapper never uses an intervention from a different status', () => {
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

  const result = toDashboardStone(stone);

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
