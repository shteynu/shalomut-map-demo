import type {
  IAiAnalysisRunRepository,
  IAiInsightsRepository,
  ISurveyRepository,
} from '@/lib/repositories/interfaces';
import type { AiAnalysisRun } from '@/lib/types/ai-analysis-run';
import { effectivePrivacyThreshold } from '@/lib/survey-definition';
import {
  recordAiJobQueued,
  recordAiJobRearmed,
} from '@/lib/server/ai-operational-metrics';

export type AutoEnqueueOutcome =
  | 'below_threshold'
  | 'already_generated'
  | 'enqueued'
  | 'duplicate'
  | 'already_active'
  | 'not_retryable'
  | 'retries_exhausted';

/**
 * How many automatic runs one round may spend. Three outlasts the ordinary
 * case — a school submitting in one burst, where each late response invalidates
 * the run in flight — while keeping a pathological round from draining provider
 * quota one response at a time.
 */
export const AI_ANALYSIS_AUTOMATIC_MAX_RUNS = 3;

/**
 * The one failure a fresh attempt can actually fix.
 *
 * `round_validation_failed` means the analysis was correct about a set of
 * responses that no longer matches what Core recalculated at callback time: the
 * round kept accepting responses while the run worked. Nothing is wrong with
 * the model, the payload or the worker, so the same work on newer input can
 * succeed.
 *
 * Every other failure describes something a retry would reproduce.
 * `contract_validation_failed` and `analysis_validation_failed` are about the
 * payload the service produced, and `lease_exhausted` is about a worker that
 * keeps dying. Re-arming those would spend two dozen provider calls to fail the
 * same way.
 */
const REARMABLE_FAILURE_CODE = 'round_validation_failed';

const isActive = (run: AiAnalysisRun) =>
  run.state === 'queued' || run.state === 'running';

/**
 * The request key for the round's nth automatic run. The first keeps the bare
 * `automatic` it has always used, so rounds already in the database are not
 * re-analysed by the numbering alone. Later keys stay derived from the history
 * rather than random, which is what lets two concurrent submissions compute the
 * same key and collapse on the unique constraint instead of starting two runs.
 */
function automaticRequestKey(attempt: number): string {
  return attempt === 1 ? 'automatic' : `automatic:${attempt}`;
}

/**
 * Automatic path used after a respondent submission. It dispatches at most one
 * analytics run at a time and at most `AI_ANALYSIS_AUTOMATIC_MAX_RUNS` in
 * total: below the privacy threshold nothing happens, an already persisted
 * legacy result is never regenerated, and a stable per-attempt request key
 * collapses concurrent submissions durably.
 *
 * A previous automatic run that failed on stale input does not end the round's
 * chances. That failure is the expected outcome when a response lands while the
 * analysis of the earlier ones is still running, and without a re-arm the
 * round's dashboard would stay empty until a manager noticed and triggered a
 * run by hand.
 */
export async function enqueueAiAnalyticsAfterResponse(
  roundId: string,
  storedPrivacyThreshold: number,
  aiAnalysisRunRepo: IAiAnalysisRunRepository,
  aiInsightsRepo: IAiInsightsRepository,
  surveyRepo: ISurveyRepository,
): Promise<AutoEnqueueOutcome> {
  const responseCount = await surveyRepo.getResponseCount(roundId);
  if (responseCount < effectivePrivacyThreshold(storedPrivacyThreshold)) {
    return 'below_threshold';
  }

  if (await aiInsightsRepo.findByRoundId(roundId)) {
    return 'already_generated';
  }

  const runs = await aiAnalysisRunRepo.findByRoundId(roundId);

  // A result already exists, whoever asked for it. A manual trigger that
  // succeeded closes the automatic path just as an automatic one does.
  if (runs.some((run) => run.state === 'succeeded')) {
    return 'already_generated';
  }

  const active = runs.find(isActive);
  if (active) {
    return 'already_active';
  }

  const automaticRuns = runs.filter((run) => run.trigger === 'automatic');
  const previous = automaticRuns[automaticRuns.length - 1];

  if (previous) {
    if (previous.failureCode !== REARMABLE_FAILURE_CODE) {
      return 'not_retryable';
    }
    if (automaticRuns.length >= AI_ANALYSIS_AUTOMATIC_MAX_RUNS) {
      return 'retries_exhausted';
    }
  }

  const attempt = automaticRuns.length + 1;
  const enqueued = await aiAnalysisRunRepo.enqueue(roundId, {
    requestKey: automaticRequestKey(attempt),
    trigger: 'automatic',
  });
  if (enqueued.outcome === 'enqueued') {
    recordAiJobQueued(enqueued.run);
    if (previous) {
      recordAiJobRearmed(enqueued.run, {
        attempt,
        previousFailureCode: REARMABLE_FAILURE_CODE,
      });
    }
  }
  return enqueued.outcome;
}
