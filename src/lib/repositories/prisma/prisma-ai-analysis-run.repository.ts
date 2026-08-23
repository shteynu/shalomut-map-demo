import type { IAiAnalysisRunRepository } from '../interfaces';
import type {
  AiAnalysisQueueSnapshot,
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
    // A row written before the column existed reads as an empty list, which is
    // the same thing it always meant: analyse the whole round.
    regenerateDimensionIds: Array.isArray(record.regenerateDimensionIds)
      ? [...record.regenerateDimensionIds]
      : [],
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
      regenerateDimensionIds?: readonly string[];
    },
  ): Promise<EnqueueAiAnalysisRunResult> {
    // The automatic path now varies its request key per attempt, so the
    // `(round_id, request_key)` constraint no longer doubles as the
    // one-run-at-a-time guard for it. Nothing needs to change here: the
    // partial unique index `ai_analysis_runs_one_active_per_round_key` holds
    // that invariant across processes whatever the key, and its violation is
    // resolved as `already_active` below.
    try {
      const created = await this.delegate.create({
        data: {
          roundId,
          requestKey: input.requestKey,
          trigger: input.trigger,
          state: 'queued',
          queuedAt: this.now(),
          regenerateDimensionIds: [...(input.regenerateDimensionIds ?? [])],
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
          regenerateDimensionIds: [...(input.regenerateDimensionIds ?? [])],
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

  async findLatestResultByRoundId(
    roundId: string,
  ): Promise<Record<string, unknown> | null> {
    // `succeeded` rather than a filter on the JSON column: a run reaches that
    // state by delivering a result and no other way, and asking for "not JSON
    // null" would need the Prisma namespace's own null sentinel here, which is
    // more coupling than this repository has anywhere else.
    //
    // Ordered by sequence rather than by any timestamp: `sequence` is what
    // orders runs everywhere else here, and a clock that moves backwards must
    // not change which map is the current one.
    const run = await this.delegate.findFirst({
      where: { roundId, state: 'succeeded' },
      orderBy: { sequence: 'desc' },
    });
    const result = run?.result;
    return result && typeof result === 'object'
      ? (structuredClone(result) as Record<string, unknown>)
      : null;
  }

  async findByRoundId(roundId: string): Promise<AiAnalysisRun[]> {
    const runs = await this.delegate.findMany({
      where: { roundId },
      orderBy: { sequence: 'asc' },
    });
    return runs.map(mapRun);
  }

  async deleteByRoundId(roundId: string): Promise<void> {
    await this.delegate.deleteMany({ where: { roundId } });
  }

  async readQueueSnapshot(): Promise<AiAnalysisQueueSnapshot> {
    const observedAt = this.now();

    /*
     * Four reads rather than one, and every one of them is an index seek on
     * `[state, leaseExpiresAt, queuedAt]` — the index `claimNext` already
     * needs, so this adds no schema and no migration. Counting in the database
     * rather than fetching rows matters here: the answer must not get slower as
     * the table grows, since the case worth reading it in is the one where runs
     * have been piling up.
     *
     * Nothing sweeps and nothing writes. A detector that repaired what it found
     * would be a second claimer racing the first, and this has to be safe to
     * call from a monitor every minute.
     */
    const [queuedCount, runningCount, leasedCount, oldestQueued, oldestAbandoned] =
      await Promise.all([
        this.delegate.count({ where: { state: 'queued' } }),
        this.delegate.count({ where: { state: 'running' } }),
        this.delegate.count({
          where: { state: 'running', leaseExpiresAt: { gt: observedAt } },
        }),
        this.delegate.findFirst({
          where: { state: 'queued' },
          orderBy: { queuedAt: 'asc' },
          select: { queuedAt: true },
        }),
        this.delegate.findFirst({
          where: { state: 'running', leaseExpiresAt: { lte: observedAt } },
          orderBy: { leaseExpiresAt: 'asc' },
          select: { leaseExpiresAt: true },
        }),
      ]);

    /*
     * The abandoned run is measured from its expiry rather than from
     * `queuedAt`: it became takeable again when its lease ran out, and dating
     * it from the beginning would report a run that started promptly and died
     * an hour later as having waited an hour.
     *
     * `attemptCount` is deliberately not filtered on. A run that has exhausted
     * its attempts is still work sitting in the table with nobody touching it,
     * and `claimNext` marks it `lease_exhausted` — which is itself something
     * only a live worker does. Excluding it here would hide the stall in the
     * exact case where the queue's last three rows are all terminal-but-unmarked.
     */
    const claimableSince = [
      oldestQueued?.queuedAt ?? null,
      oldestAbandoned?.leaseExpiresAt ?? null,
    ]
      .filter((value): value is Date | string | number => value != null)
      .map((value) => new Date(value).getTime());

    return {
      observedAt,
      queuedCount,
      runningCount,
      leasedCount,
      oldestClaimableSince: claimableSince.length
        ? new Date(Math.min(...claimableSince))
        : null,
    };
  }
}
