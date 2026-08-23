import type { AiInsightsLoadResult } from '@/lib/ai-insights-client';

/**
 * When the screen should look again, while an analysis is being written.
 *
 * The screen already knew how to say "the results will appear in a few
 * minutes" and already offered a button to check. What it did not do was
 * check — so the one thing a manager cannot do, which is know when three
 * minutes are up, was the thing the product asked of them.
 *
 * This is the decision half, kept apart from the hook that acts on it because
 * everything here is arithmetic on four inputs and nothing here needs React, a
 * clock or a browser to be tested.
 */

/**
 * The first look, and it is soon on purpose: a re-run that rewrites one
 * dimension is short, so the cheapest possible check can end the wait outright.
 */
export const WATCH_FIRST_DELAY_MS = 5_000;

/**
 * Where the wait settles. The same shape as the worker's own idle backoff, for
 * the same reason — a granularity of half a minute is a small part of a
 * three-minute analysis, and the alternative is a page that asks two hundred
 * times to learn one thing.
 */
export const WATCH_MAX_DELAY_MS = 30_000;

/**
 * How long the screen keeps watching before it says so and stops.
 *
 * Twenty minutes. With three lanes a burst of ten closures leaves the last
 * round waiting about ten minutes for a lane and then about three for its own
 * analysis, so anything inside twenty is a queue behaving normally. Past it the
 * honest statement is that this is not a normal wait — and the operator now has
 * a detector for that (`/api/health/ai-queue`), which is exactly why this page
 * does not have to keep asking on their behalf.
 *
 * Only time the page actually spent watching counts. A tab left hidden over
 * lunch has not been checking, and coming back to a page that gave up while
 * nobody was looking would be the wrong answer to the wrong question.
 */
export const WATCH_CEILING_MS = 20 * 60_000;

export type AiInsightsWatchPlan =
  /** Nothing is in flight. The map on screen is the whole story. */
  | { action: 'idle' }
  /** In flight, and the tab is hidden: stop asking until somebody looks. */
  | { action: 'paused' }
  /** In flight. Look again after this long. */
  | { action: 'wait'; delayMs: number }
  /** Watched to the ceiling without an answer. */
  | { action: 'gave-up' };

/**
 * Whether an analysis is being written right now.
 *
 * Two shapes mean the same thing and both have to count. A round with no map
 * yet reports `running` as its whole status; a round whose map is on screen
 * while a re-analysis runs reports `ready` with a `refresh`. Watching only the
 * first would leave the case where the map changes under the manager as the
 * silent one — which is the case the refresh note was written for.
 *
 * `loading` is deliberately not in flight. It is this screen's own request in
 * progress, not the service's work, and treating it as work would schedule a
 * second check on top of the one already running.
 */
export function isAnalysisInFlight(state: AiInsightsLoadResult): boolean {
  if (state.status === 'running') return true;
  if (state.status === 'ready' || state.status === 'locked') {
    return state.refresh?.state === 'running';
  }
  return false;
}

/** The next wait, doubling from the first look up to the ceiling. */
export function nextWatchDelayMs(previousDelayMs: number | null): number {
  if (previousDelayMs === null) return WATCH_FIRST_DELAY_MS;
  return Math.min(previousDelayMs * 2, WATCH_MAX_DELAY_MS);
}

export function planAiInsightsWatch(input: {
  inFlight: boolean;
  /** `document.hidden`, or `false` anywhere without a document. */
  hidden: boolean;
  /** Visible milliseconds spent watching this run. */
  watchedMs: number;
  /** The wait that was used last, or `null` when this watch is starting. */
  previousDelayMs: number | null;
}): AiInsightsWatchPlan {
  if (!input.inFlight) return { action: 'idle' };

  /*
   * The ceiling outranks the hidden check: a page that watched to the end and
   * was then hidden has still given up, and reporting it as merely paused
   * would promise a resumption that is not coming.
   */
  if (input.watchedMs >= WATCH_CEILING_MS) return { action: 'gave-up' };
  if (input.hidden) return { action: 'paused' };

  return { action: 'wait', delayMs: nextWatchDelayMs(input.previousDelayMs) };
}

/**
 * Whether this result is a finished map, for the purpose of announcing one.
 *
 * A locked round counts. Its map is as finished as it will get, and a manager
 * who watched a run to its end deserves to be told it ended whether or not the
 * threshold let them read it.
 */
export function isSettledMap(state: AiInsightsLoadResult): boolean {
  return (
    (state.status === 'ready' || state.status === 'locked') &&
    state.refresh === undefined
  );
}
