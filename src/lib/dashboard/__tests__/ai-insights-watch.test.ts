/**
 * When the screen looks again, and when it stops.
 *
 * The whole decision is here rather than in the hook precisely so it can be
 * checked without a browser, a clock or a React renderer — the project's
 * component tests render to static markup and could never have exercised a
 * timer.
 */
import assert from 'node:assert';
import test from 'node:test';

import type { AiInsightsLoadResult } from '../../ai-insights-client';
import {
  WATCH_CEILING_MS,
  WATCH_FIRST_DELAY_MS,
  WATCH_MAX_DELAY_MS,
  isAnalysisInFlight,
  isSettledMap,
  nextWatchDelayMs,
  planAiInsightsWatch,
} from '../ai-insights-watch';

const emptyMap = {} as AiInsightsLoadResult extends { value: infer V }
  ? V
  : never;

const running: AiInsightsLoadResult = { status: 'running' };
const ready: AiInsightsLoadResult = { status: 'ready', value: emptyMap };
const readyWhileRerunning: AiInsightsLoadResult = {
  status: 'ready',
  value: emptyMap,
  refresh: { state: 'running' },
};
const readyAfterFailedRerun: AiInsightsLoadResult = {
  status: 'ready',
  value: emptyMap,
  refresh: { state: 'failed', failureCode: 'provider_unavailable' },
};
const locked: AiInsightsLoadResult = { status: 'locked', value: emptyMap };

test('a round with no map yet is in flight', () => {
  assert.strictEqual(isAnalysisInFlight(running), true);
});

test('a map being rewritten is in flight, which is the silent case', () => {
  // Without this the screen would watch only the empty state and leave the
  // case where the map changes under the manager unwatched.
  assert.strictEqual(isAnalysisInFlight(readyWhileRerunning), true);
});

test('a finished map, a failed re-run and an error are not in flight', () => {
  assert.strictEqual(isAnalysisInFlight(ready), false);
  assert.strictEqual(isAnalysisInFlight(readyAfterFailedRerun), false);
  assert.strictEqual(isAnalysisInFlight({ status: 'not-found' }), false);
  assert.strictEqual(
    isAnalysisInFlight({ status: 'error', error: 'nope' }),
    false,
  );
});

test('the wait starts short and doubles to the ceiling', () => {
  assert.strictEqual(nextWatchDelayMs(null), WATCH_FIRST_DELAY_MS);
  assert.strictEqual(nextWatchDelayMs(5_000), 10_000);
  assert.strictEqual(nextWatchDelayMs(10_000), 20_000);
  assert.strictEqual(nextWatchDelayMs(20_000), WATCH_MAX_DELAY_MS);
  assert.strictEqual(nextWatchDelayMs(WATCH_MAX_DELAY_MS), WATCH_MAX_DELAY_MS);
});

test('nothing in flight means no watching at all', () => {
  assert.deepStrictEqual(
    planAiInsightsWatch({
      inFlight: false,
      hidden: false,
      watchedMs: 0,
      previousDelayMs: null,
    }),
    { action: 'idle' },
  );
});

test('a hidden tab is not asked to keep checking', () => {
  assert.deepStrictEqual(
    planAiInsightsWatch({
      inFlight: true,
      hidden: true,
      watchedMs: 0,
      previousDelayMs: null,
    }),
    { action: 'paused' },
  );
});

test('the first look happens soon, and later ones drift out', () => {
  assert.deepStrictEqual(
    planAiInsightsWatch({
      inFlight: true,
      hidden: false,
      watchedMs: 0,
      previousDelayMs: null,
    }),
    { action: 'wait', delayMs: WATCH_FIRST_DELAY_MS },
  );

  assert.deepStrictEqual(
    planAiInsightsWatch({
      inFlight: true,
      hidden: false,
      watchedMs: 60_000,
      previousDelayMs: 20_000,
    }),
    { action: 'wait', delayMs: WATCH_MAX_DELAY_MS },
  );
});

test('a normal queue wait is well inside the ceiling', () => {
  // Three lanes and ten closures leave the last round about thirteen minutes.
  // If that gave up, the feature would be worse than the button it replaces.
  const plan = planAiInsightsWatch({
    inFlight: true,
    hidden: false,
    watchedMs: 13 * 60_000,
    previousDelayMs: WATCH_MAX_DELAY_MS,
  });

  assert.strictEqual(plan.action, 'wait');
});

test('past the ceiling it gives up rather than asking forever', () => {
  assert.deepStrictEqual(
    planAiInsightsWatch({
      inFlight: true,
      hidden: false,
      watchedMs: WATCH_CEILING_MS,
      previousDelayMs: WATCH_MAX_DELAY_MS,
    }),
    { action: 'gave-up' },
  );
});

test('having given up outranks being hidden', () => {
  // Reporting a spent watch as merely paused would promise a resumption that
  // is never coming.
  assert.deepStrictEqual(
    planAiInsightsWatch({
      inFlight: true,
      hidden: true,
      watchedMs: WATCH_CEILING_MS + 1,
      previousDelayMs: WATCH_MAX_DELAY_MS,
    }),
    { action: 'gave-up' },
  );
});

test('a settled map is one with nothing replacing it, locked included', () => {
  assert.strictEqual(isSettledMap(ready), true);
  assert.strictEqual(isSettledMap(locked), true);
  assert.strictEqual(isSettledMap(readyWhileRerunning), false);
  assert.strictEqual(isSettledMap(running), false);
  assert.strictEqual(isSettledMap({ status: 'not-found' }), false);
});

test('a failed re-run is neither watched nor announced', () => {
  // Not in flight, so the screen stops asking: the run already ended. Not
  // settled either, so nothing says "the analysis finished" over a map that
  // did not change — the refresh note already says the map is the previous
  // one, and that is the true sentence.
  assert.strictEqual(isAnalysisInFlight(readyAfterFailedRerun), false);
  assert.strictEqual(isSettledMap(readyAfterFailedRerun), false);
});
