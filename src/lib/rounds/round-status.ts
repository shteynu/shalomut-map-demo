import type { RoundStatus } from "../types/backend";

/**
 * Where a round may go from where it is.
 *
 * A draft has no answers yet, so it opens or it is filed away; there is nothing
 * to close. A running round closes when collection ends. A closed round can be
 * opened again, because a school that wants a few more answers should not have
 * to start a new round for them. Archiving is the way out of all three, and it
 * is the end: an archived round has no transition out.
 */
const roundTransitions: Record<RoundStatus, readonly RoundStatus[]> = {
  draft: ["active", "archived"],
  active: ["closed", "archived"],
  closed: ["active", "archived"],
  archived: [],
};

/**
 * The single answer to "may this round become that?", for the route that
 * refuses the change and for the screen that decides whether to offer it.
 *
 * Both sides need it, which is why it lives here rather than inside
 * `RoundService`: the screen is a client component, and a button offered for a
 * transition the route will refuse is a button that can only produce an error.
 */
export function isRoundTransitionAllowed(
  current: RoundStatus,
  target: RoundStatus,
): boolean {
  return roundTransitions[current]?.includes(target) ?? false;
}

/**
 * Whether the round can still receive an answer.
 *
 * Two things read this and they must not drift apart. The analysis withholds a
 * collecting round's numbers, because a round that is still filling up would
 * otherwise publish a fresh basis of calculation on every read and two reads
 * either side of one submission would name the person between them (ADR-030).
 * The screens then explain that lock, and an explanation that disagreed with
 * the verdict would be worse than none.
 *
 * A draft counts as collecting: it has not published, and its questionnaire is
 * still being built.
 */
export function isRoundCollecting(status: RoundStatus): boolean {
  return status === "active" || status === "draft";
}
