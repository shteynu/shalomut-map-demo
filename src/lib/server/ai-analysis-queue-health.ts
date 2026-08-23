import { AI_ANALYSIS_QUEUE_STALL_AFTER_MS } from '@/lib/server/ai-analysis-worker';
import type { AiAnalysisQueueSnapshot } from '@/lib/types/ai-analysis-run';

/**
 * Whether anybody is taking the work.
 *
 * The audit of 2026-08-21 found that nothing answers this question: the sweep
 * that expires abandoned leases runs inside `claimNext`, which only a live
 * worker calls, so a consumer that stops leaves its runs `queued` for ever and
 * Core cannot tell. This is that detector, and the whole of it is the reading
 * below — no new column, no new write, and nothing recorded on the poll path.
 *
 * The naive version of it does not work. "Oldest queued run is older than N"
 * cannot separate a dead consumer from a busy one, because ten rounds closing
 * together legitimately leave the tenth waiting half an hour. What separates
 * them is the lease: a worker that is merely busy is holding one, and a worker
 * that has died stops holding any within ninety seconds. So the verdict needs
 * both halves — work nobody can be shown to be working on, *and* time.
 */
export type AiAnalysisQueueStatus = 'idle' | 'draining' | 'stalled';

export interface AiAnalysisQueueAssessment {
  status: AiAnalysisQueueStatus;
  /** Runs a worker could take right now: queued, plus abandoned running ones. */
  waitingCount: number;
  /** Runs being worked on under a live lease. */
  leasedCount: number;
  /**
   * How long the oldest takeable run has been takeable, or `null` when nothing
   * is. Rounded to whole seconds: this is read by monitors and by people, and a
   * sub-millisecond figure would only invite comparisons it cannot support.
   */
  oldestWaitSeconds: number | null;
}

export function assessAiAnalysisQueue(
  snapshot: AiAnalysisQueueSnapshot,
  options: { stallAfterMs?: number } = {},
): AiAnalysisQueueAssessment {
  const stallAfterMs = options.stallAfterMs ?? AI_ANALYSIS_QUEUE_STALL_AFTER_MS;

  /*
   * Abandoned running runs are waiting work, not running work. Their worker is
   * gone by definition — the lease it held has expired — so counting them as
   * running would report the exact failure this exists to catch as healthy.
   */
  const waitingCount =
    snapshot.queuedCount + (snapshot.runningCount - snapshot.leasedCount);

  const oldestWaitMs =
    snapshot.oldestClaimableSince === null
      ? null
      : Math.max(
          0,
          snapshot.observedAt.getTime() -
            snapshot.oldestClaimableSince.getTime(),
        );

  return {
    status: decide({ waitingCount, oldestWaitMs, leased: snapshot.leasedCount }),
    waitingCount,
    leasedCount: snapshot.leasedCount,
    oldestWaitSeconds:
      oldestWaitMs === null ? null : Math.floor(oldestWaitMs / 1000),
  };

  function decide(input: {
    waitingCount: number;
    oldestWaitMs: number | null;
    leased: number;
  }): AiAnalysisQueueStatus {
    // Nothing to take. A round being analysed right now is not the queue's
    // problem, so a busy consumer with an empty queue reads `idle` — which is
    // what "no work is waiting" means, and the only thing a monitor needs.
    if (input.waitingCount === 0 || input.oldestWaitMs === null) return 'idle';

    // Somebody is demonstrably alive and working. Whatever is waiting is
    // waiting for them, which is the queue doing its job however long it takes.
    if (input.leased > 0) return 'draining';

    // Nobody holds a lease, but a live worker between polls holds none either.
    // Only time tells those apart, and the threshold is what it costs.
    return input.oldestWaitMs > stallAfterMs ? 'stalled' : 'draining';
  }
}
