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

export type AiInsightsReadResult =
  | { outcome: 'found'; insights: Record<string, any> }
  | { outcome: 'missing'; run: AiAnalysisRun | null };

export type AiInsightsCallbackResult =
  | { outcome: 'round_not_found' }
  | { outcome: 'run_not_found'; runId: string }
  | { outcome: 'run_round_mismatch'; runId: string }
  | { outcome: 'contract_invalid'; error: string }
  | { outcome: 'round_mismatch'; error: string }
  | { outcome: 'lease_stale'; runId: string }
  | { outcome: 'persisted'; duplicate: boolean };

/**
 * Reads the result a manager is asking for. The durable run owns it; the round
 * column is the dual-read that keeps a result written before `AiAnalysisRun`
 * existed reachable. A missing result carries the run, if any, because the run
 * is what explains the absence.
 */
export async function readAiInsights(
  roundId: string,
  repositories: Pick<AiInsightsRepositories, 'aiAnalysisRunRepo' | 'aiInsightsRepo'>,
): Promise<AiInsightsReadResult> {
  const run = await repositories.aiAnalysisRunRepo.findLatestByRoundId(roundId);
  if (run?.result) {
    return { outcome: 'found', insights: run.result };
  }
  if (run) {
    return { outcome: 'missing', run };
  }

  const insights = await repositories.aiInsightsRepo.findByRoundId(roundId);
  return insights
    ? { outcome: 'found', insights }
    : { outcome: 'missing', run: null };
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

  const roundError = isDynamicVersion
    ? verifyAiResultAgainstRound(
        validation.value,
        round,
        // Verified against what Core would have sent for this deployment's
        // contract version, not against everything Core knows.
        encodeRoundAnalytics(
          AnalyticsService.calculateDynamicRoundAnalytics(
            round,
            await repositories.surveyRepo.findResponsesByRoundId(roundId),
          ),
        ),
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

  let completionOutcome: 'transitioned' | 'duplicate' | undefined;
  if (runId && leaseToken) {
    const succeeded =
      validation.value.status === 'success' ||
      validation.value.status === 'locked_error';
    const failureCode =
      'failureReason' in validation.value &&
      typeof validation.value.failureReason === 'string'
        ? validation.value.failureReason
        : 'analysis_validation_failed';
    const result = structuredClone(validation.value) as unknown as Record<
      string,
      unknown
    >;
    const outcome = await repositories.aiAnalysisRunRepo.finish(
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
    if (outcome === 'not_found') {
      return { outcome: 'run_not_found', runId };
    }
    if (outcome === 'stale') {
      return { outcome: 'lease_stale', runId };
    }
    completionOutcome = outcome;
    if (outcome === 'transitioned') {
      const completed = await repositories.aiAnalysisRunRepo.findById(runId);
      if (completed) recordAiJobCompleted(completed);
    }
  }

  if (!runId || completionOutcome === 'transitioned') {
    recordValidMapSample({
      contractVersion: validation.value.contractVersion,
      roundId,
      runId: runId ?? undefined,
    });
  }

  // Dual-write during rollout keeps the legacy reader/rollback path viable.
  const saved = await repositories.aiInsightsRepo.save(
    roundId,
    validation.value,
  );
  if (!saved) {
    return { outcome: 'round_not_found' };
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
