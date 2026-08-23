import { validateStoneMapResult } from '@/lib/ai-contract';
import { encodeRoundAnalytics } from '@/lib/analytics-encoder';
import { getCapabilities } from '@/lib/contract-registry';
import type {
  IAiAnalysisRunRepository,
  IAiInsightsRepository,
  IRoundRepository,
  ISurveyRepository,
} from '@/lib/repositories/interfaces';
import { AnalyticsService } from '@/lib/services/analytics.service';
import {
  recordAiJobCompleted,
  recordContractValidation,
  recordDeterministicMetricNarrativeSample,
  recordDeterministicSummarySample,
  recordValidMapSample,
} from '@/lib/server/ai-operational-metrics';
import { verifyAiResultAgainstRound } from '@/lib/server/verify-ai-result';
import type { AiAnalysisRun } from '@/lib/types/ai-analysis-run';

export interface AiInsightsRepositories {
  aiAnalysisRunRepo: IAiAnalysisRunRepository;
  aiInsightsRepo: IAiInsightsRepository;
  roundRepo: IRoundRepository;
  surveyRepo: ISurveyRepository;
}

/**
 * The durable identity of one callback. Both fields are present or both are
 * absent: a callback either belongs to a leased run or is the legacy
 * direct-write path. The route decides which by reading the request.
 */
export interface AiCallbackIdentity {
  runId: string | null;
  leaseToken: string | null;
}

/**
 * The two stores a finished callback writes, and nothing else.
 *
 * Narrow on purpose: these two writes go into one transaction, and a
 * transaction is a lock held on the way back from a paid analysis. Everything
 * the callback reads, validates and recomputes happens before it opens.
 */
export interface AiCallbackWriteStores {
  aiAnalysisRunRepo: IAiAnalysisRunRepository;
  aiInsightsRepo: IAiInsightsRepository;
}

/**
 * How the two writes below are run together.
 *
 * The caller supplies it because only an entrypoint may resolve the wiring
 * (ADR-008), and a transaction is a second resolution — `runInTransaction` in
 * the composition root. The default runs the work against the repositories this
 * service was already handed, which is what an in-memory test wants and what a
 * deployment with no database configured falls back to.
 */
export type AiCallbackWriteRunner = <T>(
  work: (stores: AiCallbackWriteStores) => Promise<T>,
) => Promise<T>;

/**
 * The map a manager gets, and what the round's newest run is doing.
 *
 * Both halves travel together on purpose. The map is the newest result the
 * round actually has; the run is what is happening to it now. Answering only
 * one of them is what produced the defect this replaces — a re-analysis in
 * flight became "no map", and a failed one became "no map" for good.
 */
export type AiInsightsReadResult =
  | {
      outcome: 'found';
      insights: Record<string, any>;
      run: AiAnalysisRun | null;
    }
  | { outcome: 'missing'; run: AiAnalysisRun | null };

export type AiInsightsCallbackResult =
  | { outcome: 'round_not_found' }
  | { outcome: 'run_not_found'; runId: string }
  | { outcome: 'run_round_mismatch'; runId: string }
  | { outcome: 'contract_invalid'; error: string }
  | { outcome: 'round_mismatch'; error: string }
  | { outcome: 'lease_stale'; runId: string }
  | { outcome: 'write_failed' }
  | { outcome: 'persisted'; duplicate: boolean };

/**
 * Reads the map a manager is asking for, and reports what the newest run is
 * doing to it.
 *
 * The map is `findLatestResultByRoundId` — the newest result the round actually
 * has — and not the newest run's own `result`. Those are different rounds of
 * the same question, and the difference was a real defect: this used to resolve
 * through `findLatestByRoundId`, which prefers an active run and otherwise
 * takes the newest in any state. So pressing "rewrite this dimension" made the
 * whole map unreadable for the ~3 minutes the re-run took, and a re-run that
 * failed hid it indefinitely — while the previous successful map sat in the
 * database the entire time.
 *
 * The round column stays as the dual-read that keeps a result written before
 * `AiAnalysisRun` existed reachable. Both outcomes carry the run, because the
 * run is what explains an absence and what qualifies a map that is being
 * replaced.
 */
export async function readAiInsights(
  roundId: string,
  repositories: Pick<AiInsightsRepositories, 'aiAnalysisRunRepo' | 'aiInsightsRepo'>,
): Promise<AiInsightsReadResult> {
  const run = await repositories.aiAnalysisRunRepo.findLatestByRoundId(roundId);

  const succeeded =
    await repositories.aiAnalysisRunRepo.findLatestResultByRoundId(roundId);
  if (succeeded) {
    return { outcome: 'found', insights: succeeded, run };
  }

  const insights = await repositories.aiInsightsRepo.findByRoundId(roundId);
  return insights
    ? { outcome: 'found', insights, run }
    : { outcome: 'missing', run };
}

/**
 * The legacy column would not take the write.
 *
 * Thrown rather than returned so the transaction around both writes rolls back
 * — a run closed beside a column that refused the map is the divergence this
 * whole seam exists to prevent. Its own class so the `catch` cannot swallow a
 * bug from somewhere else and report it as a retriable write failure.
 */
class AiInsightsWriteFailed extends Error {
  constructor(roundId: string) {
    super(`The round's stored analysis could not be written: ${roundId}`);
    this.name = 'AiInsightsWriteFailed';
  }
}

/**
 * Everything the callback does once the request itself is understood: resolve
 * the round and the leased run, judge the payload against the contract and
 * against Core's own analytics, close the durable run and persist the result.
 *
 * Identity is resolved before validation can mark anything failed. Otherwise a
 * callback aimed at the wrong round could fail a healthy leased run by
 * carrying nothing but an invalid payload.
 */
export async function applyAiInsightsCallback(
  roundId: string,
  identity: AiCallbackIdentity,
  payload: unknown,
  repositories: AiInsightsRepositories,
  runWrites: AiCallbackWriteRunner = (work) => work(repositories),
): Promise<AiInsightsCallbackResult> {
  const { runId, leaseToken } = identity;

  const round = await repositories.roundRepo.findById(roundId);
  if (!round) {
    return { outcome: 'round_not_found' };
  }

  if (runId && leaseToken) {
    const run = await repositories.aiAnalysisRunRepo.findById(runId);
    if (!run) {
      return { outcome: 'run_not_found', runId };
    }
    if (run.roundId !== roundId) {
      return { outcome: 'run_round_mismatch', runId };
    }
  }

  const validation = validateStoneMapResult(payload, roundId);

  async function failDurableRun(failureCode: string) {
    if (!runId || !leaseToken) return;
    const outcome = await repositories.aiAnalysisRunRepo.finish(runId, {
      state: 'failed',
      failureCode,
      leaseToken,
      callbackReceivedAt: new Date(),
    });
    if (outcome === 'transitioned') {
      const completed = await repositories.aiAnalysisRunRepo.findById(runId);
      if (completed) recordAiJobCompleted(completed);
    }
  }

  if (!validation.ok) {
    await failDurableRun('contract_validation_failed');
    recordContractValidation({
      contractVersion: callbackContractVersion(payload),
      error: validation.error,
      roundId,
      runId: runId ?? undefined,
    });
    return { outcome: 'contract_invalid', error: validation.error };
  }

  const isDynamicVersion = getCapabilities(
    validation.value.contractVersion,
  ).supportsDynamicQuestions;

  /*
   * Verified against what Core would have sent for this deployment's contract
   * version, not against everything Core knows — and read through
   * `getAnalyticsForRound` for the same reason: that is the call the MCP tool
   * made when it handed these numbers out. Recomputing here instead would
   * compare the payload against a second calculation of the same round, which
   * is both the expensive way to ask and the way to disagree with ourselves.
   */
  const roundAnalytics = isDynamicVersion
    ? await AnalyticsService.getAnalyticsForRound(
        roundId,
        repositories.roundRepo,
        repositories.surveyRepo,
      )
    : null;
  const roundError = roundAnalytics
    ? verifyAiResultAgainstRound(
        validation.value,
        round,
        encodeRoundAnalytics(roundAnalytics),
      )
    : null;
  if (roundError) {
    await failDurableRun('round_validation_failed');
    recordContractValidation({
      contractVersion: validation.value.contractVersion,
      error: roundError,
      roundId,
      runId: runId ?? undefined,
    });
    return { outcome: 'round_mismatch', error: roundError };
  }

  /*
   * A payload that carries a result, rather than one that reports a failure.
   * `locked_error` counts: a round below the privacy threshold produces a map
   * that is deliberately locked, which is an answer and not a breakdown.
   *
   * Read once and used twice — to close the durable run and to decide whether
   * the round's rollback copy may be replaced — because those two must agree.
   */
  const payloadCarriesAResult =
    validation.value.status === 'success' ||
    validation.value.status === 'locked_error';

  /*
   * Both writes, together or neither.
   *
   * They used to be two: the durable run was closed, and then the round's
   * legacy `aiInsights` column was written separately. A crash or a dropped
   * connection between them left a run marked `succeeded` beside a column
   * holding the map it was meant to replace — the two stores disagreeing about
   * the same analysis, with nothing to notice it. The audit of 2026-08-21 named
   * it; `runInTransaction` (ADR-041's neighbour, built for the round reset)
   * is what the route hands in.
   *
   * Nothing is read, validated or recomputed in here. This is the whole reason
   * the seam is this narrow: the transaction opens on the way back from a paid
   * analysis, and holding it across `AnalyticsService` would be a lock held for
   * the length of a computation.
   */
  type WriteOutcome =
    | { kind: 'done'; completion?: 'transitioned' | 'duplicate' }
    | { kind: 'refused'; result: AiInsightsCallbackResult };

  let writeOutcome: WriteOutcome;
  try {
    writeOutcome = await runWrites(async (stores): Promise<WriteOutcome> => {
      let completion: 'transitioned' | 'duplicate' | undefined;

      if (runId && leaseToken) {
        const succeeded = payloadCarriesAResult;
        const failureCode =
          'failureReason' in validation.value &&
          typeof validation.value.failureReason === 'string'
            ? validation.value.failureReason
            : 'analysis_validation_failed';
        const result = structuredClone(validation.value) as unknown as Record<
          string,
          unknown
        >;
        const outcome = await stores.aiAnalysisRunRepo.finish(
          runId,
          succeeded
            ? {
                state: 'succeeded',
                leaseToken,
                result,
                callbackReceivedAt: new Date(),
              }
            : {
                state: 'failed',
                leaseToken,
                result,
                failureCode,
                callbackReceivedAt: new Date(),
              },
        );
        /*
         * A verdict about this callback, not a failure of the write. Returned
         * rather than thrown so the transaction commits nothing and the route
         * still answers the specific 404 or 409 the worker knows how to stop
         * on. There is nothing to roll back at this point either way.
         */
        if (outcome === 'not_found') {
          return { kind: 'refused', result: { outcome: 'run_not_found', runId } };
        }
        if (outcome === 'stale') {
          return { kind: 'refused', result: { outcome: 'lease_stale', runId } };
        }
        completion = outcome;
      }

      /*
       * Dual-write during rollout keeps the legacy reader/rollback path viable
       * — for results. A failure payload is not one.
       *
       * This used to write whatever validated, so a re-run that failed
       * overwrote the round's rollback copy of the map it was meant to replace.
       * The durable run keeps the failure with its own row and its
       * `failureCode`; the column is the copy someone falls back to, and a
       * fallback to a failure is not a fallback.
       */
      if (payloadCarriesAResult) {
        const saved = await stores.aiInsightsRepo.save(
          roundId,
          validation.value,
        );
        /*
         * `save` collapses every reason into `false`, and this used to be
         * reported as `round_not_found` — a 404, which the worker reads as a
         * verdict about the payload and stops on. A dropped connection then
         * threw away a paid analysis that was correct.
         *
         * The round was read at the top of this function, so `false` here is a
         * failed write far more often than a vanished round — and a round that
         * really did vanish is caught by that read on the retry, which answers
         * the 404 from the place that actually knows. So this throws: the
         * transaction rolls back, the run goes back to `running` with its
         * lease, and the route answers a 500 the worker will try again.
         */
        if (!saved) throw new AiInsightsWriteFailed(roundId);
      }

      return { kind: 'done', completion };
    });
  } catch (error) {
    if (!(error instanceof AiInsightsWriteFailed)) throw error;
    return { outcome: 'write_failed' };
  }

  if (writeOutcome.kind === 'refused') return writeOutcome.result;
  const completionOutcome = writeOutcome.completion;

  /*
   * Recorded after the writes are durable, not between them. Observability may
   * not run inside a transaction (ADR-041) and a metric about a completed job
   * is a claim that the completion happened — which, until the commit, it had
   * not.
   */
  if (runId && completionOutcome === 'transitioned') {
    const completed = await repositories.aiAnalysisRunRepo.findById(runId);
    if (completed) recordAiJobCompleted(completed);
  }

  if (!runId || completionOutcome === 'transitioned') {
    recordValidMapSample({
      contractVersion: validation.value.contractVersion,
      roundId,
      runId: runId ?? undefined,
    });
    recordDeterministicSummarySample({
      contractVersion: validation.value.contractVersion,
      outcomes: Object.values(validation.value.stones ?? {}).map(
        (stone) => stone.generationProvenance?.outcome ?? 'unknown',
      ),
      roundId,
      runId: runId ?? undefined,
    });
    recordDeterministicMetricNarrativeSample({
      contractVersion: validation.value.contractVersion,
      outcomes: Object.values(validation.value.stones ?? {}).map(
        (stone) => stone.generationProvenance?.metricInsightsOutcome,
      ),
      roundId,
      runId: runId ?? undefined,
    });
  }

  return { outcome: 'persisted', duplicate: completionOutcome === 'duplicate' };
}

/**
 * The version a rejected payload claims. Schema validation has already failed
 * by the time this matters, so the value is read defensively and only for the
 * operational metric.
 */
function callbackContractVersion(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const value = (payload as { contractVersion?: unknown }).contractVersion;
  return typeof value === 'string' ? value : undefined;
}
