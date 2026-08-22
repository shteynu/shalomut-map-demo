/**
 * How many responses one round will ever store.
 *
 * The submit endpoint is the only unauthenticated write in the product. Its
 * rate limit is deliberately loose — a staffroom answers from one address, and
 * a limit tuned for a script would refuse exactly the moment the product is
 * working — so a patient script has always been able to write rows into a round
 * for as long as it liked. Nothing stopped it, and nothing said so.
 *
 * ## What a ceiling does and does not buy
 *
 * It bounds the rows. That is worth having on its own: an unbounded
 * unauthenticated write is a cost anyone can impose, and a round holding tens
 * of thousands of rows is a manager's screen that never loads again.
 *
 * It does **not** protect the ratio. A school of sixty with a ceiling of one
 * hundred and eighty leaves room for a hundred and twenty fabricated answers
 * beside sixty real ones, and no ceiling that a real round can reach is also a
 * ceiling that makes stuffing pointless. The answer to *that* is a submission
 * bound to something this server issued, which is the open half of the
 * 2026-08-21 audit's entry and a change to the respondent flow rather than a
 * number. Saying so here keeps the next reader from mistaking this file for the
 * whole defence.
 *
 * ## The numbers
 *
 * Three times the school's own count of its staff. The product itself publishes
 * response rates over 100% — a link forwarded past the staff list is ordinary,
 * and `totalStaffCount` is a figure a manager typed once and rarely revisits —
 * so a ceiling anywhere near 1× would refuse honest answers. Three times is
 * past anything an honest round produces and still a bound rather than none.
 *
 * A floor of one hundred, because the multiplier alone trusts a number nobody
 * checks. A manager who typed `2` into the staff field must not lose the
 * staffroom's answers to their own typo, and one hundred responses is more than
 * any single school in this product's audience sends. Above thirty-four staff
 * the floor never applies.
 */

export const RESPONSE_CEILING_MULTIPLIER = 3;
export const RESPONSE_CEILING_FLOOR = 100;

/**
 * `totalStaffCount` is a required positive integer on the organization, but it
 * arrives here from a database row rather than from a validator, so a missing
 * or nonsensical figure falls back to the floor instead of computing a ceiling
 * of zero and refusing every respondent in the school.
 */
export function responseCeiling(totalStaffCount: number | undefined): number {
  if (
    typeof totalStaffCount !== 'number' ||
    !Number.isFinite(totalStaffCount) ||
    totalStaffCount <= 0
  ) {
    return RESPONSE_CEILING_FLOOR;
  }

  return Math.max(
    RESPONSE_CEILING_FLOOR,
    Math.floor(totalStaffCount) * RESPONSE_CEILING_MULTIPLIER,
  );
}
