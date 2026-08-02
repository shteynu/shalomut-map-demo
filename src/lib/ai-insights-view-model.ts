import {
  AI_ANALYTICS_DIMENSION_IDS,
  type AnyStoneDetail,
  type ScoreDistribution,
  type StoneMapResult,
} from './ai-contract';
import type { WellbeingDimension } from './demo-data';
import { MINIMUM_PRIVACY_THRESHOLD } from './survey-definition';
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

/**
 * The split in words, skipping the buckets nobody chose.
 *
 * "0 גבוה · 0 נמוך" is noise standing where information should be, and an
 * evenly lukewarm question is exactly the case the distribution exists to
 * show — so it reads "20 משיבים · 20 באמצע" and says the same thing.
 *
 * High, middle, low: the order the bar beside this sentence is drawn in, which
 * in RTL is read from the right in exactly that sequence. The two disagreed —
 * the sentence led with the middle — and a reader comparing a segment to a
 * count had to work out which was which.
 */
function formatDistribution(
  distribution: ScoreDistribution,
  responseCount: number,
): string {
  const parts = [
    { count: distribution.green, label: 'גבוה' },
    { count: distribution.yellow, label: 'באמצע' },
    { count: distribution.red, label: 'נמוך' },
  ]
    .filter((part) => part.count > 0)
    .map((part) => `${part.count} ${part.label}`);

  return [`${responseCount} משיבים`, ...parts].join(' · ');
}

/**
 * The split of one question's answers, or nothing.
 *
 * An average of ten answers is one number; the same ten answers as three
 * counts are close to a list of who said what, and below the threshold that
 * list is short enough to attach to people. So the reading the distribution
 * enables — telling a split staff from an evenly lukewarm one — is shown only
 * where it describes the school rather than its individuals.
 */
function displayableDistribution(
  distribution: ScoreDistribution | undefined,
  responseCount: number,
): ScoreDistribution | undefined {
  if (!distribution || responseCount < MINIMUM_PRIVACY_THRESHOLD) {
    return undefined;
  }

  const total = distribution.green + distribution.yellow + distribution.red;
  return total === responseCount ? distribution : undefined;
}

export function getStoneInsight(
  stoneMap: StoneMapResult,
  dimensionId: string,
): AnyStoneDetail | undefined {
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
  stone: AnyStoneDetail,
  overallSummary?: string,
): WellbeingDimension {
  void overallSummary;
  const summary =
    'summary' in stone
      ? stone.summary
      : [stone.psychologicalInterpretation].filter(
          (paragraph): paragraph is string => Boolean(paragraph?.trim()),
        );

  return {
    ...dimension,
    score: Math.round(stone.score),
    status: stone.status,
    summary,
    // The score, the metrics and the recommendations of this dimension are all
    // real; only the paragraph about them is missing. Saying which is the point
    // of the partial map.
    interpretationUnavailable:
      stone.generationProvenance?.outcome === 'unavailable',
    metrics: stone.metrics.map((metric) => {
      if ('insightText' in metric) {
        return {
          label: metric.label,
          value: '',
          helper: '',
          highlightText: metric.insightText,
          narrativeOnly: true,
        };
      }

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
      const distribution = displayableDistribution(
        metric.scoreDistribution,
        metric.responseCount!,
      );
      if (distribution) {
        return {
          label: metric.label,
          value: formatQuestionAverage(metric.averageScore!),
          // The counts live in the sentence, never in the bar alone.
          helper: formatDistribution(distribution, metric.responseCount!),
          distribution,
        };
      }

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
