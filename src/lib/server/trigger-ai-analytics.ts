import type {
  IAiAnalysisRunRepository,
  ISurveyRepository,
} from '@/lib/repositories/interfaces';
import { effectivePrivacyThreshold } from '@/lib/survey-definition';
import { recordAiJobQueued } from '@/lib/server/ai-operational-metrics';

export type ClosureEnqueueOutcome =
  | 'below_threshold'
  | 'enqueued'
  | 'duplicate'
  | 'already_active';

/**
 * The request key for the nth run a closing dispatched.
 *
 * Derived from the round's own history rather than random, which is what lets
 * two requests racing on one close compute the same key and collapse on
 * `@@unique([roundId, requestKey])` instead of starting two runs. A round that
 * was reopened and closed again gets the next key and a genuinely new analysis,
 * because it is a genuinely different set of answers.
 */
function closureRequestKey(attempt: number): string {
  return attempt === 1 ? 'closure' : `closure:${attempt}`;
}

/**
 * Dispatch the analysis a manager asked for by closing the round.
 *
 * This function used to be `enqueueAiAnalyticsAfterResponse` and ran after
 * every respondent submission. Owner decision 2026-08-17 moved analysis to the
 * moment a round closes, and most of what the old version did existed only to
 * survive that firing rate: a re-arm on `round_validation_failed`, because a
 * response landing mid-run invalidated the run; and a ceiling of three
 * automatic runs, because without one a school submitting in a burst could
 * spend a provider call per answer. A round that is closed refuses submissions
 * (`submit/route.ts`), so neither has a subject left, and both are gone rather
 * than kept as machinery nothing drives.
 *
 * What is deliberately **not** kept either is the old `already_generated`
 * guard. It stopped a round being analysed twice, which was right when every
 * answer could ask; closing is a deliberate act, `closed → closed` is not an
 * allowed transition, and a school that reopened a round to collect a few more
 * answers wants the analysis of what it has now.
 *
 * What remains is the threshold — the reason this returns an outcome rather
 * than nothing — and the partial unique index that keeps one run per round in
 * flight.
 */
export async function enqueueAiAnalyticsOnClosure(
  roundId: string,
  storedPrivacyThreshold: number,
  aiAnalysisRunRepo: IAiAnalysisRunRepository,
  surveyRepo: ISurveyRepository,
): Promise<ClosureEnqueueOutcome> {
  const responseCount = await surveyRepo.getResponseCount(roundId);
  if (responseCount < effectivePrivacyThreshold(storedPrivacyThreshold)) {
    return 'below_threshold';
  }

  const runs = await aiAnalysisRunRepo.findByRoundId(roundId);
  const closureRuns = runs.filter((run) => run.trigger === 'closure');

  const enqueued = await aiAnalysisRunRepo.enqueue(roundId, {
    requestKey: closureRequestKey(closureRuns.length + 1),
    trigger: 'closure',
  });
  if (enqueued.outcome === 'enqueued') {
    recordAiJobQueued(enqueued.run);
  }

  return enqueued.outcome;
}
