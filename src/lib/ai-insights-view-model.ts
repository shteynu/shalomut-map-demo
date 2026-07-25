import {
  AI_ANALYTICS_DIMENSION_IDS,
  type StoneDetail,
  type StoneMapResult,
} from './ai-contract';
import type { WellbeingDimension } from './demo-data';
import type {
  WellbeingDimensionId,
  WellbeingStatus,
} from './shalomut-source';

export type DimensionActionPresentation = {
  dimensionTitle: 'חוזקה לשימור' | 'תמונת מצב';
  actionsTitle: 'פעולות לשימור' | 'מטרות ויעדים';
  actionItemLabel: 'פעולת שימור' | 'יעד';
};

export function getDimensionActionPresentation(
  status: WellbeingStatus,
): DimensionActionPresentation {
  if (status === 'green') {
    return {
      dimensionTitle: 'חוזקה לשימור',
      actionsTitle: 'פעולות לשימור',
      actionItemLabel: 'פעולת שימור',
    };
  }

  return {
    dimensionTitle: 'תמונת מצב',
    actionsTitle: 'מטרות ויעדים',
    actionItemLabel: 'יעד',
  };
}

function formatQuestionAverage(averageScore: number): string {
  return `${Math.round(averageScore * 100) / 100} מתוך 100`;
}

export function getStoneInsight(
  stoneMap: StoneMapResult,
  dimensionId: string,
): StoneDetail | undefined {
  if (
    !AI_ANALYTICS_DIMENSION_IDS.includes(
      dimensionId as WellbeingDimensionId,
    )
  ) {
    return undefined;
  }

  return stoneMap.stones?.[dimensionId as WellbeingDimensionId];
}

export function applyStoneInsightToDimension(
  dimension: WellbeingDimension,
  stone: StoneDetail,
  overallSummary?: string,
): WellbeingDimension {
  void overallSummary;
  const summary = [stone.psychologicalInterpretation].filter(
    (paragraph): paragraph is string => Boolean(paragraph?.trim()),
  );

  return {
    ...dimension,
    score: Math.round(stone.score),
    status: stone.status,
    summary,
    metrics: stone.metrics.map((metric) => {
      const hasQuestionAggregate =
        typeof metric.questionId === 'string' &&
        typeof metric.averageScore === 'number' &&
        Number.isFinite(metric.averageScore) &&
        typeof metric.responseCount === 'number' &&
        Number.isInteger(metric.responseCount);

      if (!hasQuestionAggregate) {
        return {
          label: metric.label,
          value: metric.value,
          helper: metric.trend || 'נתון מתוך ניתוח השלומות',
        };
      }

      const trend = metric.trend?.trim();
      return {
        label: metric.label,
        value: formatQuestionAverage(metric.averageScore!),
        helper: `${metric.responseCount} משיבים${trend ? ` • ${trend}` : ''}`,
      };
    }),
    recommendations: stone.recommendedInterventions
      .filter(
        (intervention) =>
          intervention.dimensionId === stone.dimensionId &&
          (intervention.status === undefined ||
            intervention.status === stone.status),
      )
      .map((intervention) => {
        const actionSteps = intervention.actionable_steps
          .map((step) => step.trim())
          .filter(Boolean);
        const actionText =
          actionSteps.length > 0
            ? ` צעדים מוצעים: ${actionSteps.join(' • ')}`
            : '';

        return {
          title: intervention.title,
          body: `${intervention.summary}${actionText}`,
        };
      }),
  };
}
