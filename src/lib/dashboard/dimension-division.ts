import type { CanonicalQuestionAggregate } from "@/lib/types/canonical-analytics";
import { surveyInstrument, type WellbeingDimensionId } from "@/lib/shalomut-source";

/**
 * A dimension whose staff room does not agree with itself.
 *
 * The dimension score is a mean, and a mean cannot tell one room from two.
 * Thirty yellow answers and eighteen green plus twelve red both score 60 — same
 * number, same colour, same headline — while in the second school four teachers
 * in ten said the aspect requires action. The score is not wrong; it is simply
 * unable to carry the fact, and nothing else on the map was carrying it either.
 */
export interface DimensionDivision {
  dimensionId: WellbeingDimensionId;
  /** Share of this dimension's answers at each end, rounded to whole percent. */
  greenPercent: number;
  redPercent: number;
}

/**
 * How much of a dimension's answers has to sit at each end before the room
 * counts as divided.
 *
 * A fifth is a product judgement rather than a statistic, and it is written
 * here once so that it can be argued with in one place. Two things recommend
 * it. It is the point at which a principal reading "60" would act differently
 * for knowing the shape behind it — one in five colleagues at the opposite end
 * is a group, not a mood. And because the privacy threshold is ten respondents
 * and every respondent answers every question of a dimension, one person is
 * worth at most a tenth of that dimension's answers: a fifth can therefore
 * never be one teacher having a bad week, at any sample size the product will
 * ever show.
 */
const DIVIDED_END_SHARE = 0.2;

/**
 * The dimensions of this round whose answers are split between the two ends,
 * in the instrument's own dimension order.
 *
 * Aggregates carry the distribution already — the calculation has always had
 * this and only the mean was reaching the screen — so this needs no new data,
 * no new column and no contract version.
 *
 * A locked round yields nothing, for the same reason it yields no scores: its
 * aggregates are empty by construction, and a division is a detailed result.
 */
export function dividedDimensions(
  questionAggregates: Record<string, CanonicalQuestionAggregate>,
): DimensionDivision[] {
  const totals = new Map<
    WellbeingDimensionId,
    { green: number; red: number; all: number }
  >();

  for (const aggregate of Object.values(questionAggregates)) {
    const { green, yellow, red } = aggregate.scoreDistribution;
    const running = totals.get(aggregate.dimensionId) ?? {
      green: 0,
      red: 0,
      all: 0,
    };

    running.green += green;
    running.red += red;
    running.all += green + yellow + red;
    totals.set(aggregate.dimensionId, running);
  }

  const divisions: DimensionDivision[] = [];

  // The instrument's order rather than the aggregates' own, so the sentence on
  // screen lists the dimensions in the order the map is read in.
  for (const dimension of surveyInstrument.dimensions) {
    const totalsForDimension = totals.get(dimension.id);
    if (!totalsForDimension) continue;

    const { green, red, all } = totalsForDimension;
    if (all === 0) continue;

    const greenShare = green / all;
    const redShare = red / all;
    if (greenShare < DIVIDED_END_SHARE || redShare < DIVIDED_END_SHARE) {
      continue;
    }

    divisions.push({
      dimensionId: dimension.id,
      greenPercent: Math.round(greenShare * 100),
      redPercent: Math.round(redShare * 100),
    });
  }

  return divisions;
}
