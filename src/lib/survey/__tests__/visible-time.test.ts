/**
 * The one number this feature adds to a respondent's record, so these tests are
 * about the ways it could be wrong in the direction that matters: a clock that
 * kept running behind a hidden tab, or one that resumed from nothing and
 * reported an attentive respondent as the fastest in the round.
 */
import assert from 'node:assert';
import test from 'node:test';

import {
  MAX_VISIBLE_INTERVAL_MS,
  MAX_VISIBLE_TOTAL_MS,
  createVisibleTimeClock,
  visibleSecondsForSubmission,
} from '../visible-time';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

test('a clock that never started has counted nothing', () => {
  const clock = createVisibleTimeClock();

  assert.strictEqual(clock.elapsed(10 * MINUTE), 0);
});

test('a visible interval counts, and the interval in progress is included', () => {
  const clock = createVisibleTimeClock();

  clock.show(0);

  assert.strictEqual(clock.elapsed(90 * SECOND), 90 * SECOND);
});

test('time behind a hidden tab does not count', () => {
  const clock = createVisibleTimeClock();

  clock.show(0);
  clock.hide(2 * MINUTE);
  // Forty minutes with the questionnaire behind something else.
  clock.show(42 * MINUTE);
  clock.hide(45 * MINUTE);

  assert.strictEqual(clock.elapsed(45 * MINUTE), 5 * MINUTE);
});

test('hiding twice banks once', () => {
  const clock = createVisibleTimeClock();

  clock.show(0);
  clock.hide(MINUTE);
  clock.hide(30 * MINUTE);

  assert.strictEqual(clock.elapsed(30 * MINUTE), MINUTE);
});

test('showing twice does not restart the interval', () => {
  const clock = createVisibleTimeClock();

  clock.show(0);
  clock.show(30 * SECOND);

  assert.strictEqual(clock.elapsed(60 * SECOND), 60 * SECOND);
});

test('a clock resumed from a stored total continues from it', () => {
  const clock = createVisibleTimeClock(4 * MINUTE);

  clock.show(0);

  assert.strictEqual(clock.elapsed(MINUTE), 5 * MINUTE);
});

test('a nonsense resume value is treated as no time at all', () => {
  for (const value of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
    const clock = createVisibleTimeClock(value);

    assert.strictEqual(clock.elapsed(0), 0, `resume from ${value}`);
  }
});

test('one impossible interval is capped rather than banked', () => {
  // A laptop that slept with the tab in the foreground: no visibility event
  // ever fired, and the interval is eleven hours of nothing.
  const clock = createVisibleTimeClock();

  clock.show(0);
  clock.hide(11 * 60 * MINUTE);

  assert.strictEqual(clock.elapsed(11 * 60 * MINUTE), MAX_VISIBLE_INTERVAL_MS);
});

test('an interval in progress is capped the same way as a banked one', () => {
  const clock = createVisibleTimeClock();

  clock.show(0);

  assert.strictEqual(clock.elapsed(11 * 60 * MINUTE), MAX_VISIBLE_INTERVAL_MS);
});

test('many possible intervals across days are capped in total', () => {
  const clock = createVisibleTimeClock();

  for (let day = 0; day < 10; day += 1) {
    clock.show(day * 24 * 60 * MINUTE);
    clock.hide(day * 24 * 60 * MINUTE + 100 * MINUTE);
  }

  assert.strictEqual(clock.elapsed(0), MAX_VISIBLE_TOTAL_MS);
});

test('a clock running backwards contributes nothing, not a negative', () => {
  const clock = createVisibleTimeClock(MINUTE);

  clock.show(10 * MINUTE);
  clock.hide(5 * MINUTE);

  assert.strictEqual(clock.elapsed(5 * MINUTE), MINUTE);
});

test('the submitted value is whole seconds', () => {
  assert.strictEqual(visibleSecondsForSubmission(90_400), 90);
  assert.strictEqual(visibleSecondsForSubmission(1_501), 2);
});

test('a clock that never ran sends nothing rather than zero', () => {
  // Zero would report the respondent as the fastest in the round, which is the
  // opposite of what "we could not measure this" means.
  assert.strictEqual(visibleSecondsForSubmission(0), undefined);
  assert.strictEqual(visibleSecondsForSubmission(400), undefined);
  assert.strictEqual(visibleSecondsForSubmission(Number.NaN), undefined);
});

test('the submitted value cannot exceed the total ceiling', () => {
  assert.strictEqual(
    visibleSecondsForSubmission(50 * 60 * MINUTE),
    MAX_VISIBLE_TOTAL_MS / 1000,
  );
});
