import {
  AI_ANALYTICS_DIMENSION_IDS,
  type AnyStoneDetail,
  type ScoreDistribution,
  type StoneMapResult,
} from './ai-contract';
import type {
  DashboardInsightsDto,
  DashboardMetric,
  DashboardRecommendation,
  DashboardStone,
} from './dashboard/dashboard-insights';
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

function toDashboardMetrics(stone: AnyStoneDetail): DashboardMetric[] {
  return stone.metrics.map((metric) => {
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
  });
}

function toDashboardRecommendations(
  stone: AnyStoneDetail,
): DashboardRecommendation[] {
  return stone.recommendedInterventions
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
        // Carried rather than rendered here: the screen decides how to show an
        // attribution, and dropping it at this seam is what made the advice
        // look like it came from nowhere.
        source: intervention.source.trim(),
        // `adaptationOutcome` reached the wire since 5.0 and was validated
        // but never read on any screen: a recommendation still on its catalog
        // wording looked identical to one rewritten for this round. One call
        // adapts every entry of a dimension together, so this is uniform
        // within a dimension in practice, but it is read per entry because
        // that is the shape the payload actually carries.
        interventionIsDeterministic:
          intervention.adaptationOutcome === 'deterministic_fallback',
      };
    });
}

export function toDashboardStone(stone: AnyStoneDetail): DashboardStone {
  const summary =
    'summary' in stone
      ? stone.summary
      : [stone.psychologicalInterpretation].filter(
          (paragraph): paragraph is string => Boolean(paragraph?.trim()),
        );

  return {
    dimensionId: stone.dimensionId,
    score: Math.round(stone.score),
    status: stone.status,
    summary,
    // The score, the metrics and the recommendations of this dimension are all
    // real; only the paragraph about them is missing. Saying which is the point
    // of the partial map.
    interpretationUnavailable:
      stone.generationProvenance?.outcome === 'unavailable',
    interpretationUnavailableReason:
      stone.generationProvenance?.outcome === 'unavailable'
        ? stone.generationProvenance.unavailableReason
        : undefined,
    // Contract 6.0 has no `unavailable` for a dimension: the structured
    // summary falls back at every status rather than failing the round, so
    // without this flag a red dimension the provider never answered reads
    // exactly like one it did.
    summaryIsDeterministic:
      stone.generationProvenance?.outcome === 'deterministic_fallback',
    // Read from its own field, not from the summary's outcome: one call writes
    // the paragraphs and another writes the narratives, so a stone can have one
    // from the model and the other from the aggregates. A round that recorded
    // nothing says nothing here.
    metricNarrativesAreDeterministic:
      stone.generationProvenance?.metricInsightsOutcome ===
      'deterministic_fallback',
    metrics: toDashboardMetrics(stone),
    recommendations: toDashboardRecommendations(stone),
  };
}

/**
 * The single translation from the wire contract to what the screens render.
 *
 * Every version-shaped question — does this stone carry a three-part summary or
 * one interpretation paragraph, is this metric narrative or numeric — is
 * answered here, so no component ever holds a `StoneMapResult`.
 */
export function toDashboardInsights(
  result: StoneMapResult,
): DashboardInsightsDto {
  const stones: Partial<Record<WellbeingDimensionId, DashboardStone>> = {};

  for (const dimensionId of AI_ANALYTICS_DIMENSION_IDS) {
    const stone = result.stones?.[dimensionId];
    if (stone) stones[dimensionId] = toDashboardStone(stone);
  }

  const gaps = AI_ANALYTICS_DIMENSION_IDS.filter(
    (dimensionId) => stones[dimensionId]?.interpretationUnavailable,
  );

  return {
    roundId: result.roundId,
    overallSummary: result.overallPsychologicalSummary?.trim() ?? '',
    // Absent on a version that never asks the model for this sentence and on
    // a round analysed before the field existed — in both cases `false` is
    // the wrong answer (it would claim the model wrote something it did not
    // write and was never asked to), so the screen only ever adds a note; it
    // never claims authorship, the same rule the stones already follow.
    overallSummaryIsDeterministic:
      result.overallSummaryOutcome === 'deterministic_fallback',
    stones,
    // Derived from the stones rather than read from
    // `dimensionsWithoutInterpretation`, which carries the same answer. The
    // payload's list is a convenience for a reader and the contract already
    // requires the two to agree; deriving it here means the banner and the
    // dimension screen cannot disagree even if a payload ever slipped through
    // saying otherwise.
    dimensionsWithoutInterpretation: gaps,
    gapsByReason: {
      provider_unavailable: gaps.filter(
        (dimensionId) =>
          stones[dimensionId]?.interpretationUnavailableReason ===
          'provider_unavailable',
      ),
      validation_rejected: gaps.filter(
        (dimensionId) =>
          stones[dimensionId]?.interpretationUnavailableReason ===
          'validation_rejected',
      ),
      unstated: gaps.filter(
        (dimensionId) =>
          stones[dimensionId]?.interpretationUnavailableReason === undefined,
      ),
    },
  };
}
