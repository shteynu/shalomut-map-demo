/**
 * The verdict, without a database and without a clock.
 *
 * The case that decides whether this detector is worth having is the fourth
 * one: a legitimate backlog and a dead consumer produce the same queue depth
 * and the same wait, and only the lease tells them apart. A detector that
 * cried stall on a busy afternoon would be turned off within a week.
 */
import assert from 'node:assert';
import test from 'node:test';

import { assessAiAnalysisQueue } from '../ai-analysis-queue-health';
import { AI_ANALYSIS_QUEUE_STALL_AFTER_MS } from '../ai-analysis-worker';

const observedAt = new Date('2026-08-23T10:00:00.000Z');

function agoMs(milliseconds: number) {
  return new Date(observedAt.getTime() - milliseconds);
}

test('an empty queue is idle, whether or not a round is being analysed', () => {
  const empty = assessAiAnalysisQueue({
    observedAt,
    queuedCount: 0,
    runningCount: 0,
    leasedCount: 0,
    oldestClaimableSince: null,
  });
  assert.strictEqual(empty.status, 'idle');
  assert.strictEqual(empty.oldestWaitSeconds, null);

  const busy = assessAiAnalysisQueue({
    observedAt,
    queuedCount: 0,
    runningCount: 1,
    leasedCount: 1,
    oldestClaimableSince: null,
  });
  assert.strictEqual(busy.status, 'idle');
  assert.strictEqual(busy.waitingCount, 0);
  assert.strictEqual(busy.leasedCount, 1);
});

test('work waiting a short time is draining, because a live worker polls', () => {
  const assessment = assessAiAnalysisQueue({
    observedAt,
    queuedCount: 1,
    runningCount: 0,
    leasedCount: 0,
    oldestClaimableSince: agoMs(45_000),
  });

  assert.strictEqual(assessment.status, 'draining');
  assert.strictEqual(assessment.waitingCount, 1);
  assert.strictEqual(assessment.oldestWaitSeconds, 45);
});

test('a long backlog under a live lease is draining, not stalled', () => {
  // Ten rounds closed together: one is being analysed, nine wait, and the
  // oldest has waited half an hour. This is the queue working.
  const assessment = assessAiAnalysisQueue({
    observedAt,
    queuedCount: 9,
    runningCount: 1,
    leasedCount: 1,
    oldestClaimableSince: agoMs(30 * 60_000),
  });

  assert.strictEqual(assessment.status, 'draining');
  assert.strictEqual(assessment.waitingCount, 9);
  assert.strictEqual(assessment.oldestWaitSeconds, 1800);
});

test('the same backlog with no live lease is stalled', () => {
  // The consumer died: its lease expired, so nothing holds one, and the nine
  // that were waiting for it are now waiting for nobody.
  const assessment = assessAiAnalysisQueue({
    observedAt,
    queuedCount: 9,
    runningCount: 1,
    leasedCount: 0,
    oldestClaimableSince: agoMs(30 * 60_000),
  });

  assert.strictEqual(assessment.status, 'stalled');
  // Ten, not nine: the abandoned running run is waiting work too.
  assert.strictEqual(assessment.waitingCount, 10);
});

test('the threshold is a boundary, and one second either side of it decides', () => {
  const at = assessAiAnalysisQueue({
    observedAt,
    queuedCount: 1,
    runningCount: 0,
    leasedCount: 0,
    oldestClaimableSince: agoMs(AI_ANALYSIS_QUEUE_STALL_AFTER_MS),
  });
  assert.strictEqual(at.status, 'draining');

  const past = assessAiAnalysisQueue({
    observedAt,
    queuedCount: 1,
    runningCount: 0,
    leasedCount: 0,
    oldestClaimableSince: agoMs(AI_ANALYSIS_QUEUE_STALL_AFTER_MS + 1_000),
  });
  assert.strictEqual(past.status, 'stalled');
});

test('a clock that moved backwards reports no wait rather than a negative one', () => {
  const assessment = assessAiAnalysisQueue({
    observedAt,
    queuedCount: 1,
    runningCount: 0,
    leasedCount: 0,
    oldestClaimableSince: new Date(observedAt.getTime() + 5_000),
  });

  assert.strictEqual(assessment.oldestWaitSeconds, 0);
  assert.strictEqual(assessment.status, 'draining');
});

test('the threshold is injectable, so a caller can be stricter than the default', () => {
  const assessment = assessAiAnalysisQueue(
    {
      observedAt,
      queuedCount: 1,
      runningCount: 0,
      leasedCount: 0,
      oldestClaimableSince: agoMs(90_000),
    },
    { stallAfterMs: 60_000 },
  );

  assert.strictEqual(assessment.status, 'stalled');
});
