/**
 * What turns eighteen counters into a warning.
 *
 * The arithmetic is the whole of the decision, and every interesting case is an
 * edge of it: an empty window, a mean built from too few rounds to mean
 * anything, a count sitting exactly on its limit. These are tested against the
 * in-memory store rather than a stub, because the grouping by window is part of
 * what is being asserted.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryOperationalEventRepository } from '@/lib/repositories';
import {
  OBSERVABILITY_THRESHOLDS,
  assessObservability,
  readThreshold,
  type ObservabilityThreshold,
} from '../observability-alerts';

const NOW = new Date('2026-08-23T12:00:00.000Z');
const minutesBefore = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000);

function threshold(
  overrides: Partial<ObservabilityThreshold> = {},
): ObservabilityThreshold {
  return {
    id: 'test',
    metric: 'survey_submission_lost_after_retries',
    reading: 'count',
    windowMinutes: 360,
    limit: 1,
    says: 'test',
    ...overrides,
  };
}

test('a counter with nothing in the window reads zero, not unknown', () => {
  const reading = readThreshold(threshold(), undefined);

  assert.equal(reading.observed, 0);
  assert.equal(reading.samples, 0);
  assert.equal(reading.breached, false);
});

test('a counter breaches at its limit, not past it', () => {
  const at = readThreshold(threshold({ limit: 3 }), {
    name: 'x',
    count: 3,
    sum: 3,
  });
  const below = readThreshold(threshold({ limit: 3 }), {
    name: 'x',
    count: 2,
    sum: 2,
  });

  assert.equal(at.breached, true);
  assert.equal(below.breached, false);
});

test('a mean with too few samples says nothing rather than says healthy', () => {
  const reading = readThreshold(
    threshold({ reading: 'mean', limit: 0.5, minimumSamples: 2 }),
    { name: 'x', count: 1, sum: 1 },
  );

  // One round writing all its own copy is one round's luck. Reported as
  // unmeasured — null is not zero, and calling it zero would be the lie.
  assert.equal(reading.observed, null);
  assert.equal(reading.breached, false);
});

test('a mean over enough samples is the average of the values', () => {
  const reading = readThreshold(
    threshold({ reading: 'mean', limit: 0.5, minimumSamples: 2 }),
    { name: 'x', count: 4, sum: 3 },
  );

  assert.equal(reading.observed, 0.75);
  assert.equal(reading.breached, true);
});

test('one lost submission is enough to alert', async () => {
  const repo = new InMemoryOperationalEventRepository();
  await repo.record({
    kind: 'metric',
    name: 'survey_submission_lost_after_retries',
    value: 1,
    unit: 'count',
  });

  const assessment = await assessObservability(repo, { now: NOW });

  assert.equal(assessment.status, 'alerting');
  assert.deepEqual(assessment.alerting, ['submission_lost']);
});

test('an empty store is healthy, and says so about every threshold', async () => {
  const assessment = await assessObservability(
    new InMemoryOperationalEventRepository(),
    { now: NOW },
  );

  assert.equal(assessment.status, 'ok');
  assert.deepEqual(assessment.alerting, []);
  assert.equal(assessment.readings.length, OBSERVABILITY_THRESHOLDS.length);
});

test('an event older than its window no longer alerts', async () => {
  const repo = new InMemoryOperationalEventRepository();
  // Seven hours ago, against a six-hour window: the alert clears itself once
  // the problem stops, so nobody has to acknowledge it.
  repo.recordAt(
    {
      kind: 'metric',
      name: 'survey_submission_lost_after_retries',
      value: 1,
      unit: 'count',
    },
    minutesBefore(420),
  );

  const assessment = await assessObservability(repo, { now: NOW });

  assert.equal(assessment.status, 'ok');
});

test('the ratio threshold uses its own longer window', async () => {
  const repo = new InMemoryOperationalEventRepository();
  // Ten hours ago: outside the six-hour count window, inside the twenty-four
  // hour one the ratios use. A school closes a round every few weeks, so a
  // six-hour window would almost always hold no sample at all.
  for (const value of [1, 1]) {
    repo.recordAt(
      {
        kind: 'metric',
        name: 'ai_deterministic_summary_ratio_sample',
        value,
        unit: 'ratio_sample',
      },
      minutesBefore(600),
    );
  }

  const assessment = await assessObservability(repo, { now: NOW });

  assert.deepEqual(assessment.alerting, [
    'analysis_written_without_the_model',
  ]);
});

test('an analysis the model actually wrote does not alert', async () => {
  const repo = new InMemoryOperationalEventRepository();
  for (const value of [0, 0, 0.25]) {
    await repo.record({
      kind: 'metric',
      name: 'ai_deterministic_summary_ratio_sample',
      value,
      unit: 'ratio_sample',
    });
  }

  const assessment = await assessObservability(repo, { now: NOW });

  assert.equal(assessment.status, 'ok');
});

test('every threshold names a metric the product actually emits', () => {
  // A threshold on a name nothing writes would read as a permanent zero, which
  // is indistinguishable from health and is the failure this whole file exists
  // to end.
  const ids = OBSERVABILITY_THRESHOLDS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'threshold ids must be unique');
  assert.ok(OBSERVABILITY_THRESHOLDS.length >= 3);
});
