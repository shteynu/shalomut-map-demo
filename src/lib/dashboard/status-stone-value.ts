/**
 * What a status stone says before the map has opened.
 *
 * `getStatusCount` used to answer `0` for a locked round, and zero is a claim:
 * it says the school has no problem areas and no strengths worth keeping. On
 * day one, with nobody having answered yet, that is the empty state rendered as
 * a perfect school — and it removes the one thing the screen is there to
 * create, which is a reason to chase responses.
 *
 * The honest answer is that the number does not exist yet, so the stone shows a
 * dash and says when it will. The dash is decoration; the sentence carries the
 * meaning, and `screenReaderValue` is what a screen reader hears in its place.
 */
export const STATUS_STONE_UNAVAILABLE = "—";

export interface StatusStoneValue {
  value: string;
  /** Read instead of the dash, which announces as nothing useful. */
  screenReaderValue?: string;
  helper: string;
}

export function describeStatusStone(
  /** The counted dimensions, or `null` while analytics are locked. */
  count: number | null,
  minimumResponses: number,
  /** What the stone says once there is a number to show. */
  readyHelper: string,
  /**
   * Whether the round can still receive an answer, so the stone names the right
   * condition.
   *
   * A round still collecting does not open at any number of answers — it opens
   * when it closes — so promising it "after ten answers" is a sentence the
   * manager watches stay false from the eleventh answer onward.
   */
  isCollecting: boolean,
): StatusStoneValue {
  if (count === null) {
    return {
      value: STATUS_STONE_UNAVAILABLE,
      screenReaderValue: "עדיין אין נתון",
      helper: isCollecting
        ? "ייפתח בסגירת הסבב"
        : `ייפתח לאחר ${minimumResponses} תשובות`,
    };
  }

  return { value: String(count), helper: readyHelper };
}
