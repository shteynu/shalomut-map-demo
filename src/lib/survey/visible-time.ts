/**
 * How long the questionnaire was actually in front of the respondent.
 *
 * The round already knows how long a filling *session* lasted — the gap between
 * the first beacon and the stored response — and that number survives a
 * forgotten tab, a lunch break and a colleague at the door. It is an upper
 * bound on attention and the product says so wherever it prints it. This
 * accumulator is the other number: wall time that elapsed while the document
 * was visible and the respondent was inside the questionnaire.
 *
 * ## What it deliberately is not
 *
 * It is not per-step and it is not per-item. The plan this task came from asked
 * for per-step durations and for an aggregate to be stored from them, which
 * means the per-step values would have been collected from a respondent and
 * then discarded by the server. One accumulated number is strictly less data
 * about a person and answers every question the stored aggregate could answer,
 * so no per-step value is measured, held or sent.
 *
 * It is also not attention. A tab can be visible to a browser and behind a
 * conversation, so this is still an upper bound — a smaller one. Nothing here
 * licenses a claim about how hard someone was thinking.
 *
 * ## Why it is a plain object rather than a hook
 *
 * The clock has to survive a re-render, be resumable from a stored number after
 * a draft is restored, and be testable without a DOM. So it holds its own
 * state, takes its clock as a parameter, and knows nothing about React or about
 * `document`; the component owns the event listeners and calls `show`/`hide`.
 */

export interface VisibleTimeClock {
  /** Start or resume counting. Calling it while already running does nothing. */
  show(at: number): void;
  /** Stop counting and bank what has elapsed. Idempotent. */
  hide(at: number): void;
  /** Milliseconds counted so far, including the interval in progress. */
  elapsed(at: number): number;
}

/**
 * A ceiling on one uninterrupted visible interval.
 *
 * A machine that sleeps with the tab in the foreground wakes with a
 * `visibilitychange` that never came and an interval measured in hours. That is
 * not time in front of the questionnaire, and banking it would put one absurd
 * value into a round's middle number. Anything longer than this is banked as
 * this, which loses a little from a genuine marathon sitting and refuses to
 * invent a long one.
 *
 * Two hours is roughly five times the longest questionnaire the product
 * estimates, which makes it a guard against the impossible rather than a
 * judgement about respondents.
 */
export const MAX_VISIBLE_INTERVAL_MS = 2 * 60 * 60 * 1000;

/**
 * A ceiling on the whole attempt, applied where the number is read.
 *
 * Separate from the interval ceiling because they refuse different things: the
 * interval guard refuses one impossible stretch, and this refuses an attempt
 * that accumulated many possible ones across days. Kept in sync with the
 * server-side bound, which is the one that actually protects the database.
 */
export const MAX_VISIBLE_TOTAL_MS = 12 * 60 * 60 * 1000;

export function createVisibleTimeClock(
  resumeFromMs = 0,
): VisibleTimeClock {
  let banked = Number.isFinite(resumeFromMs) && resumeFromMs > 0 ? resumeFromMs : 0;
  let startedAt: number | null = null;

  function bank(at: number) {
    if (startedAt === null) return;

    // A clock that appears to run backwards contributes nothing rather than a
    // negative. `performance.now()` is monotonic, but the component may be
    // given `Date.now()` in a test or on a browser without it.
    const interval = Math.max(0, at - startedAt);
    banked += Math.min(interval, MAX_VISIBLE_INTERVAL_MS);
    startedAt = null;
  }

  return {
    show(at: number) {
      if (startedAt !== null) return;
      startedAt = at;
    },
    hide(at: number) {
      bank(at);
    },
    elapsed(at: number) {
      if (startedAt === null) return Math.min(banked, MAX_VISIBLE_TOTAL_MS);

      const interval = Math.min(
        Math.max(0, at - startedAt),
        MAX_VISIBLE_INTERVAL_MS,
      );

      return Math.min(banked + interval, MAX_VISIBLE_TOTAL_MS);
    },
  };
}

/**
 * The value the submit body may carry, or undefined when it may not.
 *
 * Whole seconds rather than milliseconds: the report speaks in minutes, the
 * extra resolution describes nothing, and a millisecond-exact duration is a
 * finer fingerprint of one sitting than the product has any use for.
 *
 * Zero is refused rather than sent. A questionnaire that was answered took some
 * visible time, so a zero means the clock never ran — a browser that fired no
 * visibility event, a test double, a restored draft — and sending it would
 * report the most attentive respondent in the round as the fastest.
 */
export function visibleSecondsForSubmission(
  elapsedMs: number,
): number | undefined {
  if (!Number.isFinite(elapsedMs)) return undefined;

  const seconds = Math.round(Math.min(elapsedMs, MAX_VISIBLE_TOTAL_MS) / 1000);

  return seconds > 0 ? seconds : undefined;
}
