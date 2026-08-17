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
