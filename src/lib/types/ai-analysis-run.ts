export type AiAnalysisRunState =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export type AiAnalysisRunTrigger = 'automatic' | 'manual';

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
