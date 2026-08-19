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
