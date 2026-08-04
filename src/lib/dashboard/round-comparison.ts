import type { SurveyRound } from "@/lib/types/backend";
import type { CanonicalRoundAnalytics } from "@/lib/types/canonical-analytics";
import { surveyInstrument, type WellbeingDimensionId } from "@/lib/shalomut-source";

/**
 * What changed between the round on screen and the one the school measured
 * before it. Deltas are current minus previous, in score points.
 *
 * The comparison is per dimension rather than per question on purpose: the eight
 * dimensions are the stable taxonomy across rounds, while each round carries its
 * own questionnaire snapshot, so two rounds can ask different questions and
 * still be comparable at this level (ADR-004).
 */
export interface RoundComparison {
  previousRoundId: string;
  previousRoundTitle: string;
  overallDelta: number;
  dimensionDeltas: Record<WellbeingDimensionId, number>;
}

const comparableStatuses: ReadonlySet<SurveyRound["status"]> = new Set([
  "active",
  "closed",
  "archived",
]);

/**
 * The rounds that could be the one before this one, nearest first.
 *
 * Drafts are skipped: a draft has no responses, so it is a plan rather than a
 * measurement. Rounds are ordered by when they started, which is the order a
 * manager thinks in — creation order can differ when a round is prepared early.
 *
 * A list rather than a single round because being before this one is not enough:
 * a round that never reached its privacy threshold has no numbers to compare
 * with, and the caller only discovers that after reading its analytics. It walks
 * this list and compares against the nearest round that actually produced a
 * result, which is why the comparison always names the round it used.
 */
export function comparableRoundsBefore(
  selected: SurveyRound,
  rounds: SurveyRound[],
): SurveyRound[] {
  const selectedStart = selected.startDate.getTime();

  return rounds
    .filter(
      (round) =>
        round.id !== selected.id &&
        comparableStatuses.has(round.status) &&
        round.startDate.getTime() < selectedStart,
    )
    .sort((left, right) => right.startDate.getTime() - left.startDate.getTime());
}

function averageScore(analytics: CanonicalRoundAnalytics): number {
  const total = surveyInstrument.dimensions.reduce(
    (sum, dimension) => sum + analytics.dimensionScores[dimension.id].averageScore,
    0,
  );

  return total / surveyInstrument.dimensions.length;
}

/**
 * Build the comparison, or nothing when there is nothing honest to show.
 *
 * A locked round yields no comparison at all. Its `dimensionScores` are empty by
 * construction, and a delta against an unlocked round would hand back the very
 * scores the privacy gate is withholding: a manager who knows this round's score
 * would read the previous round's straight off the difference.
 */
export function toRoundComparison(
  current: CanonicalRoundAnalytics,
  previousRound: SurveyRound | null,
  previous: CanonicalRoundAnalytics | null,
): RoundComparison | null {
  if (!previousRound || !previous) return null;
  if (current.isLocked || previous.isLocked) return null;

  const dimensionDeltas = surveyInstrument.dimensions.reduce(
    (deltas, dimension) => {
      deltas[dimension.id] = Math.round(
        current.dimensionScores[dimension.id].averageScore -
          previous.dimensionScores[dimension.id].averageScore,
      );
      return deltas;
    },
    {} as Record<WellbeingDimensionId, number>,
  );

  return {
    previousRoundId: previousRound.id,
    previousRoundTitle: previousRound.title,
    overallDelta: Math.round(averageScore(current) - averageScore(previous)),
    dimensionDeltas,
  };
}

/**
 * How a delta reads in Hebrew. Direction is spelled out rather than left to an
 * arrow or a colour, so the change survives a screen reader and a printed page.
 */
export function describeDelta(delta: number): string {
  if (delta > 0) return `עלייה של ${delta} נקודות`;
  if (delta < 0) return `ירידה של ${Math.abs(delta)} נקודות`;
  return "ללא שינוי";
}

/** The signed number as it appears on screen: `+4`, `-3`, `0`. */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/**
 * The class suffix a delta is styled with. Styling is a second channel here —
 * the sign and the Hebrew wording carry the direction on their own.
 */
export function deltaDirection(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}
