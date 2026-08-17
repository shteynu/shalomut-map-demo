/**
 * This summary is the whole of what the product may publish about how a round
 * was filled, so these tests are about what it refuses to say at least as much
 * as about what it computes — and about the case that decided its shape: a
 * round where nobody was fast has to be able to say so.
 */
import assert from 'node:assert';
import test from 'node:test';

import {
  FAST_FILLING_FRACTION,
  FILLING_DETAIL_MINIMUM,
  isFarBelowEstimate,
  summariseFillingDurations,
} from '../filling-duration';

const ESTIMATE = 24;

test('a filling shorter than a third of the estimate is far below it', () => {
  assert.strictEqual(isFarBelowEstimate(7, ESTIMATE), true);
  assert.strictEqual(isFarBelowEstimate(1, ESTIMATE), true);
});

test('the boundary itself is not far below — it is the first plausible reading', () => {
  const boundary = ESTIMATE * FAST_FILLING_FRACTION;

  assert.strictEqual(isFarBelowEstimate(boundary, ESTIMATE), false);
  assert.strictEqual(isFarBelowEstimate(boundary - 0.01, ESTIMATE), true);
});

test('a long session is never far below, however long', () => {
  assert.strictEqual(isFarBelowEstimate(ESTIMATE, ESTIMATE), false);
  assert.strictEqual(isFarBelowEstimate(600, ESTIMATE), false);
});

test('a round where nobody was fast says so, and zero names nobody', () => {
  const summary = summariseFillingDurations(
    [10, 11, 12, 13, 30, 40, 50],
    ESTIMATE,
  );

  assert.deepStrictEqual(summary.farBelowEstimate, { known: true, count: 0 });
  assert.strictEqual(summary.measured, 7);
});

test('a fast group at or above the floor is published exactly', () => {
  const summary = summariseFillingDurations(
    [1, 2, 3, 10, 12, 14, 30, 40, 50],
    ESTIMATE,
  );

  assert.deepStrictEqual(summary.farBelowEstimate, { known: true, count: 3 });
});

test('one or two fast sessions are bounded, never counted', () => {
  const one = summariseFillingDurations([1, 10, 11, 12, 30, 40], ESTIMATE);
  const two = summariseFillingDurations([1, 2, 10, 11, 12, 30, 40], ESTIMATE);

  assert.deepStrictEqual(one.farBelowEstimate, {
    known: false,
    fewerThan: FILLING_DETAIL_MINIMUM,
  });
  assert.deepStrictEqual(two.farBelowEstimate, {
    known: false,
    fewerThan: FILLING_DETAIL_MINIMUM,
  });
});

test('a withheld fast count is not recoverable from anything else published', () => {
  // The only other numbers are the total and the median. Two rounds with the
  // same total and the same median differ in how many were fast, so neither
  // published number determines the withheld one.
  const oneFast = summariseFillingDurations([1, 11, 12, 13, 40], ESTIMATE);
  const twoFast = summariseFillingDurations([1, 2, 12, 13, 40], ESTIMATE);

  assert.strictEqual(oneFast.measured, twoFast.measured);
  assert.strictEqual(oneFast.medianMinutes, twoFast.medianMinutes);
  assert.deepStrictEqual(oneFast.farBelowEstimate, twoFast.farBelowEstimate);
});

test('no sessions measured is a summary, not a crash', () => {
  const summary = summariseFillingDurations([], ESTIMATE);

  assert.strictEqual(summary.measured, 0);
  assert.deepStrictEqual(summary.farBelowEstimate, { known: true, count: 0 });
  assert.strictEqual(summary.medianMinutes, undefined);
});

test('the median is the lower middle session, rounded to a tenth of a minute', () => {
  const summary = summariseFillingDurations([1.04, 2.28, 3.51, 4.99], ESTIMATE);

  // Four sessions: the lower middle is 2.28, which rounds to 2.3. An
  // interpolated median would report 2.9, a length no session had.
  assert.strictEqual(summary.medianMinutes, 2.3);
});

test('the median appears exactly at the floor and not below it', () => {
  const atFloor = summariseFillingDurations([5, 9, 40], ESTIMATE);
  const belowFloor = summariseFillingDurations([5, 9], ESTIMATE);

  assert.strictEqual(atFloor.medianMinutes, 9);
  assert.strictEqual(belowFloor.medianMinutes, undefined);
  assert.strictEqual(FILLING_DETAIL_MINIMUM, 3);
});

test('the order of arrival does not change the median', () => {
  const forwards = summariseFillingDurations([3, 8, 21, 40, 55], ESTIMATE);
  const backwards = summariseFillingDurations([55, 40, 21, 8, 3], ESTIMATE);

  assert.strictEqual(forwards.medianMinutes, backwards.medianMinutes);
  assert.strictEqual(forwards.medianMinutes, 21);
});

test('a shorter questionnaire moves the boundary with it', () => {
  const durations = [2, 3, 4, 9, 10, 11];

  // Against a four-minute questionnaire nothing here is implausible; against a
  // twenty-four-minute one the first three are.
  assert.deepStrictEqual(summariseFillingDurations(durations, 4).farBelowEstimate, {
    known: true,
    count: 0,
  });
  assert.deepStrictEqual(
    summariseFillingDurations(durations, ESTIMATE).farBelowEstimate,
    { known: true, count: 3 },
  );
});
