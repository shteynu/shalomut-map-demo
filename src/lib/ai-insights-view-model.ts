import {
  AI_ANALYTICS_DIMENSION_IDS,
  type StoneDetail,
  type StoneMapResult,
} from './ai-contract';
import type { WellbeingDimension } from './demo-data';
import type { WellbeingDimensionId } from './shalomut-source';

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
  const summary = [
    stone.psychologicalInterpretation,
    overallSummary,
  ].filter((paragraph): paragraph is string => Boolean(paragraph?.trim()));

  return {
    ...dimension,
    score: Math.round(stone.score),
    status: stone.status,
    summary,
    metrics: stone.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      helper: metric.trend || 'נתון מתוך ניתוח השלומות',
    })),
    recommendations: stone.recommendedInterventions.map((intervention) => {
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
