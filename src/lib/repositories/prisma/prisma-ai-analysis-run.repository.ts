import type { IAiAnalysisRunRepository } from '../interfaces';
import type {
  AiAnalysisRun,
  AiAnalysisRunLease,
  EnqueueAiAnalysisRunResult,
  FinishAiAnalysisRunResult,
} from '../../types/ai-analysis-run';
import type { MinimalPrismaClient } from './prisma-client';
import { areAiAnalysisResultsEqual } from '../ai-analysis-run-result';

function cloneDate(value: unknown): Date | undefined {
  return value ? new Date(value as string | number | Date) : undefined;
}

function mapRun(record: any): AiAnalysisRun {
  return {
    id: record.id,
    sequence: record.sequence,
    roundId: record.roundId,
    requestKey: record.requestKey,
    trigger: record.trigger,
    state: record.state,
    attemptCount: record.attemptCount,
    queuedAt: new Date(record.queuedAt),
    startedAt: cloneDate(record.startedAt),
    heartbeatAt: cloneDate(record.heartbeatAt),
    leaseExpiresAt: cloneDate(record.leaseExpiresAt),
    workerId: record.workerId ?? undefined,
    completedAt: cloneDate(record.completedAt),
    callbackReceivedAt: cloneDate(record.callbackReceivedAt),
    failureCode: record.failureCode ?? undefined,
    result:
      record.result && typeof record.result === 'object'
        ? structuredClone(record.result)
        : undefined,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export class PrismaAiAnalysisRunRepository
  implements IAiAnalysisRunRepository
{
  constructor(
    private readonly prisma: MinimalPrismaClient,
    private readonly now: () => Date = () => new Date(),
    private readonly createLeaseToken: () => string = () =>
      globalThis.crypto.randomUUID(),
  ) {}

  private get delegate(): NonNullable<MinimalPrismaClient['aiAnalysisRun']> {
    if (!this.prisma.aiAnalysisRun) {
      throw new Error(
        'The generated Prisma client does not expose aiAnalysisRun. Run prisma generate after applying the durable AI jobs schema.',
      );
    }
    return this.prisma.aiAnalysisRun;
  }

  async enqueue(
    roundId: string,
    input: {
      requestKey: string;
      trigger: AiAnalysisRun['trigger'];
    },
  ): Promise<EnqueueAiAnalysisRunResult> {
    try {
      const created = await this.delegate.create({
        data: {
          roundId,
          requestKey: input.requestKey,
          trigger: input.trigger,
          state: 'queued',
          queuedAt: this.now(),
        },
      });
      return { outcome: 'enqueued', run: mapRun(created) };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const duplicate = await this.delegate.findFirst({
        where: { roundId, requestKey: input.requestKey },
      });
      if (duplicate) {
        return { outcome: 'duplicate', run: mapRun(duplicate) };
      }

      const active = await this.delegate.findFirst({
        where: { roundId, state: { in: ['queued', 'running'] } },
        orderBy: { sequence: 'desc' },
      });
      if (active) {
        return { outcome: 'already_active', run: mapRun(active) };
      }

      // The constraint winner may have completed between the failed insert and
      // our lookup. Retrying once preserves enqueue semantics without hiding a
      // persistent database error.
      const retried = await this.delegate.create({
        data: {
          roundId,
          requestKey: input.requestKey,
          trigger: input.trigger,
          state: 'queued',
          queuedAt: this.now(),
        },
      });
      return { outcome: 'enqueued', run: mapRun(retried) };
    }
  }

  async claimNext(input: {
    leaseMs: number;
    maxAttempts?: number;
    workerId: string;
  }): Promise<AiAnalysisRunLease | null> {
    // Selection and the conditional update are intentionally separate: every
    // contender may see the same candidate, but only one can update its still-
    // eligible row. A short retry lets a loser move on to another queued job.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = this.now();
      const maxAttempts = input.maxAttempts ?? 3;
      await this.delegate.updateMany({
        where: {
          state: 'running',
          leaseExpiresAt: { lte: now },
          attemptCount: { gte: maxAttempts },
        },
        data: {
          state: 'failed',
          failureCode: 'lease_exhausted',
          completedAt: now,
          heartbeatAt: null,
          leaseExpiresAt: null,
          workerId: null,
        },
      });
      const eligible = {
        OR: [
          { state: 'queued' },
          {
            state: 'running',
            leaseExpiresAt: { lte: now },
            attemptCount: { lt: maxAttempts },
          },
        ],
      };
      const candidate = await this.delegate.findFirst({
        where: eligible,
        orderBy: { sequence: 'asc' },
      });
      if (!candidate) return null;

      const leaseToken = this.createLeaseToken();
      const claimed = await this.delegate.updateMany({
        where: { id: candidate.id, ...eligible },
        data: {
          state: 'running',
          attemptCount: { increment: 1 },
          startedAt: candidate.startedAt ?? now,
          heartbeatAt: now,
          leaseExpiresAt: new Date(now.getTime() + input.leaseMs),
          leaseToken,
          workerId: input.workerId,
        },
      });
      if ((claimed?.count ?? 0) === 0) continue;

      const run = await this.delegate.findUnique({ where: { id: candidate.id } });
      if (!run) return null;
      return { run: mapRun(run), leaseToken };
    }
    return null;
  }

  async heartbeat(
    runId: string,
    leaseToken: string,
    input: { leaseMs: number },
  ): Promise<boolean> {
    const now = this.now();
    const result = await this.delegate.updateMany({
      where: {
        id: runId,
        state: 'running',
        leaseToken,
        leaseExpiresAt: { gt: now },
      },
      data: {
        heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + input.leaseMs),
      },
    });
    return (result?.count ?? 0) === 1;
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
    const now = this.now();
    const result = await this.delegate.updateMany({
      where: {
        id: runId,
        state: 'running',
        leaseToken: input.leaseToken,
        leaseExpiresAt: { gt: now },
      },
      data: {
        state: input.state,
        completedAt: now,
        callbackReceivedAt: input.callbackReceivedAt,
        failureCode: input.state === 'failed' ? input.failureCode : null,
        result: input.result,
        heartbeatAt: null,
        leaseExpiresAt: null,
        workerId: null,
      },
    });
    if ((result?.count ?? 0) === 1) return 'transitioned';

    const run = await this.delegate.findUnique({ where: { id: runId } });
    if (!run) return 'not_found';
    if (run.leaseToken !== input.leaseToken) return 'stale';
    if (run.state !== input.state) return 'stale';
    if (
      input.state === 'failed' &&
      (run.failureCode ?? undefined) !== input.failureCode
    ) {
      return 'stale';
    }
    return areAiAnalysisResultsEqual(mapRun(run).result, input.result)
      ? 'duplicate'
      : 'stale';
  }

  async findById(runId: string): Promise<AiAnalysisRun | null> {
    const run = await this.delegate.findUnique({ where: { id: runId } });
    return run ? mapRun(run) : null;
  }

  async findLatestByRoundId(roundId: string): Promise<AiAnalysisRun | null> {
    const active = await this.delegate.findFirst({
      where: { roundId, state: { in: ['queued', 'running'] } },
      orderBy: { sequence: 'desc' },
    });
    if (active) return mapRun(active);

    const run = await this.delegate.findFirst({
      where: { roundId },
      orderBy: { sequence: 'desc' },
    });
    return run ? mapRun(run) : null;
  }

  async deleteByRoundId(roundId: string): Promise<void> {
    await this.delegate.deleteMany({ where: { roundId } });
  }
}
