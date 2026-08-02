import type {
  IAiAnalysisRunRepository,
  IAiInsightsRepository,
  ISurveyRepository,
} from '@/lib/repositories/interfaces';
import { effectivePrivacyThreshold } from '@/lib/survey-definition';
import { recordAiJobQueued } from '@/lib/server/ai-operational-metrics';

export type AutoEnqueueOutcome =
  | 'below_threshold'
  | 'already_generated'
  | 'enqueued'
  | 'duplicate'
  | 'already_active';

/**
 * Automatic path used after a respondent submission. It dispatches at most one
 * analytics run per round: below the privacy threshold nothing happens, an
 * already persisted legacy result is never regenerated automatically, and the
 * stable `automatic` request key collapses concurrent submissions durably.
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

  const enqueued = await aiAnalysisRunRepo.enqueue(roundId, {
    requestKey: 'automatic',
    trigger: 'automatic',
  });
  if (enqueued.outcome === 'enqueued') {
    recordAiJobQueued(enqueued.run);
  }
  return enqueued.outcome;
}
