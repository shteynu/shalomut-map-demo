/**
 * How long a round's questionnaires took to fill, against the estimate the
 * questionnaire itself gave.
 *
 * ## What the number is, and what it is not
 *
 * One duration is the lifetime of a filling session: the gap between the first
 * beacon from that session and the response it eventually stored. It survives a
 * reload, a backgrounded tab, a colleague at the door and a lunch break, and it
 * includes none of the work a respondent did on paper first. So it is an upper
 * bound on attention, never a measurement of it, and every name here says "took
 * less than" rather than "spent".
 *
 * That asymmetry is why the report is one-sided. Below the estimate the number
 * is informative: whatever else the session was doing, the questionnaire cannot
 * have taken *more* than the elapsed time, so a short session really is a short
 * filling. Above the estimate it is close to meaningless — an open tab reports
 * six hours — so this module says nothing about the slow side at all, rather
 * than dressing noise as a finding.
 *
 * ## Why there is no histogram here
 *
 * The obvious shape is a partition — fast, normal, slow — published beside the
 * total. It was written that way first and does not survive two objections.
 *
 * A partition beside its total is solvable. Suppress the one small band and a
 * reader subtracts the others from the total and reads it anyway, which is the
 * arithmetic `src/lib/privacy/cell-suppression.ts` exists to close. Closing it
 * here costs a second suppressed band, and then the *good* case — nobody
 * filled the questionnaire suspiciously fast — renders as two blanks, which a
 * manager reads as bad news being withheld. The report would be least readable
 * exactly when it has the best thing to say.
 *
 * So this publishes one count and one middle value, and no third number to
 * solve for. What a reader can derive is that the remaining sessions took at
 * least a third of the estimate, which is a statement about a crowd at any
 * round size the report is shown at.
 *
 * ## What never leaves here
 *
 * No per-response value and no list of durations. The research behind this
 * feature (`docs/response-quality-research-2026-08-17.md` §5.3) found that any
 * subset of respondents the product singles out becomes a second basis of
 * calculation, and the round's published per-question distributions then read
 * that subset's answers directly. A count is not a subset — which is what makes
 * the describing half of this feature safe and the acting half not.
 */

/**
 * Below this many measured sessions the module states nothing but the count of
 * them.
 *
 * The same floor and the same argument as `ABANDON_DETAIL_MINIMUM = 3` in
 * `SurveyFunnelService`: a count is aggregate and harmless, but "the one person
 * who finished in ninety seconds" is a sentence about an individual in a staff
 * room of twenty, and this product's proposition is that it never produces one.
 * Smaller than the round's privacy threshold because it guards a weaker signal,
 * and a floor rather than nothing because the signal is real.
 *
 * At exactly this floor the median is one respondent's own session length. The
 * funnel's median abandonment point has that property too and was accepted with
 * it; the alternative is a floor high enough that no school of ordinary size
 * ever sees the report.
 */
export const FILLING_DETAIL_MINIMUM = 3;

/**
 * The fraction of the estimate below which a filling is reported as far below
 * it.
 *
 * Judgement, not measurement — exactly as the per-step seconds in
 * `survey-duration.ts` are judgement, and stated as a constant for the same
 * reason: so that a real sitting can replace it, and so that a later reader does
 * not mistake it for a finding.
 *
 * What makes a third defensible rather than round: the estimate allows six
 * seconds for one row inside a block of statements. A third of the estimate is
 * two seconds a row, which is less than the time to read a Hebrew sentence of a
 * dozen words, let alone decide where on the scale it falls. Above that
 * boundary a fast reader is plausible; below it the arithmetic stops working.
 */
export const FAST_FILLING_FRACTION = 1 / 3;

/**
 * How many sessions finished far below the estimate.
 *
 * Not a number with a "suppressed" flag beside it, because the two cases are
 * different facts and a screen has to say them differently. `known` carries a
 * real count — including zero, which is the answer a manager most wants and
 * which names nobody. `known: false` carries only a ceiling: at least one
 * session was that fast and fewer than `fewerThan` were, and the exact figure
 * is withheld because between those bounds it is a sentence about an
 * individual.
 */
export type FastFillingCount =
  | { readonly known: true; readonly count: number }
  | { readonly known: false; readonly fewerThan: number };

export interface FillingDurationSummary {
  /** Sessions with a usable duration. The denominator of everything above. */
  readonly measured: number;
  /** Sessions that finished in less than `FAST_FILLING_FRACTION` of the estimate. */
  readonly farBelowEstimate: FastFillingCount;
  /**
   * The middle session's length in minutes, to one decimal, or undefined below
   * the floor.
   *
   * Rounded rather than exact because an unrounded duration is a fingerprint of
   * one sitting, and the tenth of a minute is the last digit that means
   * anything about a session measured this way.
   */
  readonly medianMinutes?: number;
}

/** Whether one session finished faster than the questionnaire can be read. */
export function isFarBelowEstimate(
  minutes: number,
  estimatedMinutes: number,
): boolean {
  return minutes < estimatedMinutes * FAST_FILLING_FRACTION;
}

/**
 * Summarise a round's measured durations into what may be published about them.
 *
 * The floor lands on the fast count and on the median, and nowhere else:
 * `measured` is a denominator the manager screens already show in other forms,
 * and withholding it would make the two numbers beside it unreadable without
 * protecting anyone.
 */
export function summariseFillingDurations(
  minutes: readonly number[],
  estimatedMinutes: number,
): FillingDurationSummary {
  const fast = minutes.filter((value) =>
    isFarBelowEstimate(value, estimatedMinutes),
  ).length;

  return {
    measured: minutes.length,
    farBelowEstimate:
      fast === 0 || fast >= FILLING_DETAIL_MINIMUM
        ? { known: true, count: fast }
        : { known: false, fewerThan: FILLING_DETAIL_MINIMUM },
    medianMinutes: median(minutes),
  };
}

/**
 * The lower middle value, not the mean of the two middle ones.
 *
 * `SurveyFunnelService` already publishes a median this way, and one convention
 * for the word across the product is worth more than the half-minute an
 * interpolated median would add — which would in any case be a number that
 * describes neither of the two sessions it sits between.
 */
function median(minutes: readonly number[]): number | undefined {
  if (minutes.length < FILLING_DETAIL_MINIMUM) return undefined;

  const sorted = [...minutes].sort((left, right) => left - right);

  return round(sorted[Math.floor((sorted.length - 1) / 2)]);
}

function round(minutes: number): number {
  return Math.round(minutes * 10) / 10;
}
