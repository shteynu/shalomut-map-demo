export type AiAnalysisRunState =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

/**
 * What asked for a run.
 *
 * `closure` is what a manager closing a round dispatches, and since 2026-08-17
 * it is the ordinary entrance. `manual` remains the re-analysis button, which
 * is a second opinion on a round already closed rather than the first one.
 *
 * `automatic` is history and nothing writes it any more: it named the run that
 * fired after a respondent submission, which is exactly the behaviour that
 * decision removed. It stays in the union because rows carrying it are still
 * read, and in the database's check constraint for the same reason.
 */
export type AiAnalysisRunTrigger = 'automatic' | 'manual' | 'closure';

export interface AiAnalysisRun {
  id: string;
  sequence: number;
  roundId: string;
  requestKey: string;
  trigger: AiAnalysisRunTrigger;
  state: AiAnalysisRunState;
  attemptCount: number;
  queuedAt: Date;
  startedAt?: Date;
  heartbeatAt?: Date;
  leaseExpiresAt?: Date;
  workerId?: string;
  completedAt?: Date;
  callbackReceivedAt?: Date;
  failureCode?: string;
  result?: Record<string, unknown>;
  /**
   * The dimensions this run has to write again, or empty for the whole round.
   *
   * Empty is the ordinary case and is also what every run written before the
   * column existed carries, which is why it is an empty array rather than an
   * absent one: "this run named no dimensions" and "this run analyses the
   * round" are the same statement, and a nullable field would invite code that
   * treats them as two.
   */
  regenerateDimensionIds: string[];
}

export interface AiAnalysisRunLease {
  run: AiAnalysisRun;
  leaseToken: string;
}

export type EnqueueAiAnalysisRunOutcome =
  | 'enqueued'
  | 'duplicate'
  | 'already_active';

export interface EnqueueAiAnalysisRunResult {
  outcome: EnqueueAiAnalysisRunOutcome;
  run: AiAnalysisRun;
}

export type FinishAiAnalysisRunResult =
  | 'transitioned'
  | 'duplicate'
  | 'stale'
  | 'not_found';

/**
 * What the queue looks like at one instant, in the four facts a verdict needs.
 *
 * Counts and timestamps rather than a status, because the reading is not the
 * database's to make: `assessAiAnalysisQueue` owns the thresholds, this owns
 * what is true. Keeping them apart is what lets the verdict be tested without a
 * database and the query be tested without a clock.
 */
export interface AiAnalysisQueueSnapshot {
  /** The instant every field below was read against. */
  observedAt: Date;
  /** Runs waiting to be started for the first time. */
  queuedCount: number;
  /** Runs in `running`, whether or not their lease is still alive. */
  runningCount: number;
  /**
   * Running runs whose lease has not expired — the one proof Core has that a
   * consumer is alive. A busy worker holds exactly one per lane; a dead one
   * holds none within ninety seconds of dying.
   */
  leasedCount: number;
  /**
   * When the oldest run a worker could take right now became takeable, or
   * `null` when nothing is takeable.
   *
   * Two different clocks, deliberately: a queued run became takeable when it
   * was queued, and an abandoned running one when its lease expired. Measuring
   * the second from `queuedAt` would report a run that was picked up promptly
   * and later abandoned as having waited from the beginning.
   */
  oldestClaimableSince: Date | null;
}
