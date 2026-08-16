import type { SurveyRound } from "@/lib/types/backend";
import type { CanonicalRoundAnalytics } from "@/lib/types/canonical-analytics";
import {
  responseScale,
  surveyInstrument,
  type WellbeingDimensionId,
} from "@/lib/shalomut-source";
import { SCORING_BANDS } from "@/lib/scoring-bands";

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
  /** How many people answered each round. Never shown as one without the other. */
  currentResponseCount: number;
  previousResponseCount: number;
  /**
   * The smallest movement this pair of rounds can distinguish from one person
   * changing their mind. See `minimumReadableDelta`.
   */
  minimumReadableDelta: number;
  /**
   * Whether the two rounds measured differently — different questions, or the
   * same questions answered on a different scale or in a different direction.
   *
   * The comparison was once the one place in the system that read no identity
   * at all: a school that rewrote half its questionnaire got its delta rendered
   * exactly like a school that changed nothing. It then read
   * `surveyDefinitionHash`, which was most of the answer and not all of it —
   * that hash is the snapshot the AI is shown, and the AI is shown neither the
   * scale nor the polarity, so two rounds asking identical questions on three
   * colours and on a seven-point scale hashed the same. The delta subtracted
   * one instrument's mean from another's and the flag stayed false.
   *
   * `measurementSnapshotHash` is the identity that covers what an answer is
   * worth. It is strictly harder to collide with than the AI-visible hash, so
   * nothing this flag used to catch stopped being caught.
   *
   * It still does not cancel the comparison. Dimensions are the stable taxonomy
   * across rounds by design (ADR-004), so the delta remains the honest
   * dimension-level statement it always was — but the reader has to be told
   * that part of the movement can belong to the questionnaire rather than to
   * the school, and only this flag can tell them.
   */
  questionnaireChanged: boolean;
}

/**
 * The full width of the answer scale: the most one answer can differ from
 * another. Read off the instrument rather than written as `100`, because the
 * scale is methodology and a third colour would change it.
 */
const SCALE_RANGE =
  Math.max(...responseScale.map((option) => option.score)) -
  Math.min(...responseScale.map((option) => option.score));

/**
 * The smallest delta worth printing as a number, in score points.
 *
 * Both the overall score and each dimension score are means over respondents,
 * so one respondent carries `1/n` of the result. If that person answers at the
 * top of the scale in one round and at the bottom in the next — or simply is a
 * different person, since the rounds are anonymous and the staff room changes —
 * the score moves by `SCALE_RANGE / n` with nothing having happened to the
 * school. Anything smaller than that is inside the width of one human being.
 *
 * The smaller round governs: it is the one with the coarser resolution, and a
 * comparison is only as readable as its weaker half.
 *
 * This is deliberately not a significance test. It computes an upper bound on a
 * single respondent's influence, which is arithmetic the data supports, rather
 * than a confidence interval, which would need assumptions this instrument has
 * not earned. It is therefore optimistic: the real detectable change is larger.
 * It exists to stop the product printing "עלייה של 3 נקודות" as a fact when one
 * teacher could have produced it.
 */
export function minimumReadableDelta(
  currentResponseCount: number,
  previousResponseCount: number,
): number {
  const smaller = Math.min(currentResponseCount, previousResponseCount);
  if (!Number.isFinite(smaller) || smaller <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil(SCALE_RANGE / smaller);
}

/** Whether a delta says more about the school than about one respondent. */
export function isDeltaReadable(delta: number, minimum: number): boolean {
  return Math.abs(delta) >= minimum;
}

/**
 * Whether the score sits close enough to a band edge that the colour is a
 * coin toss at this sample size.
 *
 * The bands are a hard switch: the intervention catalogue is filtered by status
 * before it is ranked, so 74 and 75 hand a principal two different products —
 * things to fix, or a strength to preserve. The same `minimum` that governs a
 * delta governs this, because it is the same question asked once instead of
 * twice: could one respondent have put it on the other side?
 */
export function isNearBandEdge(score: number, minimum: number): boolean {
  if (!Number.isFinite(minimum)) return true;

  return SCORE_BAND_EDGES.some((edge) => Math.abs(score - edge) < minimum);
}

/**
 * Where one colour becomes the next: the lower bound of every band except the
 * lowest, which has no edge above nothing.
 */
const SCORE_BAND_EDGES: number[] = SCORING_BANDS.map((band) => band.min).filter(
  (min) => min > 0,
);

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
    currentResponseCount: current.totalResponses,
    previousResponseCount: previous.totalResponses,
    minimumReadableDelta: minimumReadableDelta(
      current.totalResponses,
      previous.totalResponses,
    ),
    questionnaireChanged:
      current.measurementSnapshotHash !== previous.measurementSnapshotHash,
  };
}

/**
 * How a delta reads in Hebrew. Direction is spelled out rather than left to an
 * arrow or a colour, so the change survives a screen reader and a printed page.
 *
 * The minimum is required rather than optional: this sentence used to state a
 * three-point rise as a fact about a school, and an argument a caller can
 * forget to pass is the same defect with a longer name.
 */
export function describeDelta(delta: number, minimum: number): string {
  if (!isDeltaReadable(delta, minimum)) {
    return "שינוי קטן מכדי לקרוא בגודל המדגם הזה";
  }
  if (delta > 0) return `עלייה של ${delta} נקודות`;
  return `ירידה של ${Math.abs(delta)} נקודות`;
}

/**
 * The signed number as it appears on screen: `+4`, `-3`, `≈`.
 *
 * `≈` covers both of the cases that are not a stated change: a movement smaller
 * than the resolution, and no movement at all. They used to be different — an
 * exact zero printed as `±0` so that "measured and unchanged" could not be read
 * as "not compared" — and the resolution makes them the same claim, because a
 * zero at ten respondents is no more certain than a three. What still separates
 * "compared" from "not compared" is whether this appears at all: no comparison
 * renders no chip.
 */
export function formatDelta(delta: number, minimum: number): string {
  if (!isDeltaReadable(delta, minimum)) return "≈";
  if (delta > 0) return `+${delta}`;

  return String(delta);
}

/**
 * The class suffix a delta is styled with. Styling is a second channel here —
 * the sign and the Hebrew wording carry the direction on their own.
 */
export function deltaDirection(
  delta: number,
  minimum: number,
): "up" | "down" | "flat" {
  if (!isDeltaReadable(delta, minimum)) return "flat";
  return delta > 0 ? "up" : "down";
}
