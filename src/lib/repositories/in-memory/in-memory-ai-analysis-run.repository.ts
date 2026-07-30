import type { IAiAnalysisRunRepository } from '../interfaces';
import type {
  AiAnalysisRun,
  AiAnalysisRunLease,
  EnqueueAiAnalysisRunResult,
  FinishAiAnalysisRunResult,
} from '../../types/ai-analysis-run';
import { areAiAnalysisResultsEqual } from '../ai-analysis-run-result';

interface InMemoryAiAnalysisRunRepositoryOptions {
  now?: () => Date;
  createId?: () => string;
}

interface StoredAiAnalysisRun extends AiAnalysisRun {
  leaseToken?: string;
}

const isActive = (run: AiAnalysisRun) =>
  run.state === 'queued' || run.state === 'running';

function cloneRun(run: StoredAiAnalysisRun): AiAnalysisRun {
  return {
    ...run,
    queuedAt: new Date(run.queuedAt),
    startedAt: run.startedAt ? new Date(run.startedAt) : undefined,
    heartbeatAt: run.heartbeatAt ? new Date(run.heartbeatAt) : undefined,
    leaseExpiresAt: run.leaseExpiresAt
      ? new Date(run.leaseExpiresAt)
      : undefined,
    completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
    callbackReceivedAt: run.callbackReceivedAt
      ? new Date(run.callbackReceivedAt)
      : undefined,
    result: run.result ? structuredClone(run.result) : undefined,
  };
}

function defaultCreateId(): string {
  return globalThis.crypto.randomUUID();
}

export class InMemoryAiAnalysisRunRepository
  implements IAiAnalysisRunRepository
{
  private readonly runs = new Map<string, StoredAiAnalysisRun>();
  private readonly now: () => Date;
  private readonly createId: () => string;
  private nextSequence = 1;

  constructor(options: InMemoryAiAnalysisRunRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? defaultCreateId;
  }

  async enqueue(
    roundId: string,
    input: {
      requestKey: string;
      trigger: AiAnalysisRun['trigger'];
    },
  ): Promise<EnqueueAiAnalysisRunResult> {
    const existingRequest = [...this.runs.values()].find(
      (run) => run.roundId === roundId && run.requestKey === input.requestKey,
    );
    if (existingRequest) {
      return { outcome: 'duplicate', run: cloneRun(existingRequest) };
    }

    const activeRun = [...this.runs.values()].find(
      (run) => run.roundId === roundId && isActive(run),
    );
    if (activeRun) {
      return { outcome: 'already_active', run: cloneRun(activeRun) };
    }

    const run: StoredAiAnalysisRun = {
      id: this.createId(),
      sequence: this.nextSequence++,
      roundId,
      requestKey: input.requestKey,
      trigger: input.trigger,
      state: 'queued',
      attemptCount: 0,
      queuedAt: this.now(),
    };
    this.runs.set(run.id, run);
    return { outcome: 'enqueued', run: cloneRun(run) };
  }

  async claimNext(input: {
    leaseMs: number;
    maxAttempts?: number;
    workerId: string;
  }): Promise<AiAnalysisRunLease | null> {
    const now = this.now();
    const maxAttempts = input.maxAttempts ?? 3;
    for (const run of this.runs.values()) {
      if (
        run.state === 'running' &&
        run.leaseExpiresAt &&
        run.leaseExpiresAt.getTime() <= now.getTime() &&
        run.attemptCount >= maxAttempts
      ) {
        run.state = 'failed';
        run.failureCode = 'lease_exhausted';
        run.completedAt = now;
        run.heartbeatAt = undefined;
        run.leaseExpiresAt = undefined;
        run.workerId = undefined;
      }
    }
    const candidate = [...this.runs.values()]
      .filter(
        (run) =>
          run.state === 'queued' ||
          (run.state === 'running' &&
            run.leaseExpiresAt !== undefined &&
            run.leaseExpiresAt.getTime() <= now.getTime() &&
            run.attemptCount < maxAttempts),
      )
      .sort((left, right) => left.sequence - right.sequence)[0];

    if (!candidate) return null;

    const leaseToken = this.createId();
    candidate.state = 'running';
    candidate.attemptCount += 1;
    candidate.startedAt ??= now;
    candidate.heartbeatAt = now;
    candidate.leaseExpiresAt = new Date(now.getTime() + input.leaseMs);
    candidate.workerId = input.workerId;
    candidate.leaseToken = leaseToken;

    return { run: cloneRun(candidate), leaseToken };
  }

  async heartbeat(
    runId: string,
    leaseToken: string,
    input: { leaseMs: number },
  ): Promise<boolean> {
    const run = this.runs.get(runId);
    const now = this.now();
    if (
      !run ||
      run.state !== 'running' ||
      run.leaseToken !== leaseToken ||
      !run.leaseExpiresAt ||
      run.leaseExpiresAt.getTime() <= now.getTime()
    ) {
      return false;
    }

    run.heartbeatAt = now;
    run.leaseExpiresAt = new Date(now.getTime() + input.leaseMs);
    return true;
  }

  async finish(
    runId: string,
    input:
      | {
          state: 'succeeded';
          leaseToken: string;
          result: Record<string, unknown>;
          callbackReceivedAt?: Date;
        }
      | {
          state: 'failed';
          leaseToken: string;
          failureCode: string;
          result?: Record<string, unknown>;
          callbackReceivedAt?: Date;
        },
  ): Promise<FinishAiAnalysisRunResult> {
    const run = this.runs.get(runId);
    if (!run) return 'not_found';
    if (run.leaseToken !== input.leaseToken) return 'stale';
    if (
      run.state === 'running' &&
      (!run.leaseExpiresAt ||
        run.leaseExpiresAt.getTime() <= this.now().getTime())
    ) {
      return 'stale';
    }

    if (run.state === input.state) {
      const sameFailure =
        input.state === 'succeeded' || run.failureCode === input.failureCode;
      return sameFailure && areAiAnalysisResultsEqual(run.result, input.result)
        ? 'duplicate'
        : 'stale';
    }
    if (run.state !== 'running') return 'stale';

    const now = this.now();
    run.state = input.state;
    run.completedAt = now;
    run.callbackReceivedAt = input.callbackReceivedAt
      ? new Date(input.callbackReceivedAt)
      : undefined;
    run.failureCode = input.state === 'failed' ? input.failureCode : undefined;
    run.result = input.result ? structuredClone(input.result) : undefined;
    run.heartbeatAt = undefined;
    run.leaseExpiresAt = undefined;
    run.workerId = undefined;
    return 'transitioned';
  }

  async findById(runId: string): Promise<AiAnalysisRun | null> {
    const run = this.runs.get(runId);
    return run ? cloneRun(run) : null;
  }

  async findLatestByRoundId(roundId: string): Promise<AiAnalysisRun | null> {
    const roundRuns = [...this.runs.values()].filter(
      (run) => run.roundId === roundId,
    );
    const latest = (roundRuns.some(isActive)
      ? roundRuns.filter(isActive)
      : roundRuns
    )
      .sort((left, right) => right.sequence - left.sequence)[0];
    return latest ? cloneRun(latest) : null;
  }

  async deleteByRoundId(roundId: string): Promise<void> {
    for (const [runId, run] of this.runs) {
      if (run.roundId === roundId) this.runs.delete(runId);
    }
  }

  clear(): void {
    this.runs.clear();
    this.nextSequence = 1;
  }
}
