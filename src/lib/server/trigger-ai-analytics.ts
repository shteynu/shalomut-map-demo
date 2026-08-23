import type {
  IAiAnalysisRunRepository,
  ISurveyRepository,
} from '@/lib/repositories/interfaces';
import { effectivePrivacyThreshold } from '@/lib/survey-definition';
import { recordAiJobQueued } from '@/lib/server/ai-operational-metrics';
import type { SurveyRound } from '@/lib/types/backend';

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

/** What one superseded round's dispatch came to. */
export interface SupersededRoundDispatch {
  roundId: string;
  outcome: ClosureEnqueueOutcome | 'not_dispatched';
}

/**
 * Dispatch the analysis of the rounds an activation closed on its way through.
 *
 * One school runs one round at a time (owner decision 2026-08-03), so starting
 * a round closes whichever round was running. Until 2026-08-23 that close was
 * the one kind that asked for nothing: `enqueueAiAnalyticsOnClosure` had a
 * single caller, the PATCH route, so a round the manager closed by hand was
 * analysed and a round the manager closed by publishing its successor was not
 * — and never would be, because closing is the only thing that asks and that
 * round can no longer be closed again. The school lost the map of a completed
 * round to an action it took on a different one.
 *
 * A failure here is swallowed per round for the same reason it is swallowed in
 * the PATCH route: the close already happened, the round it belongs to is
 * already live, and the re-analysis button is the way back. Refusing the
 * activation because a queue row could not be written would undo a round the
 * manager did start to recover a map they did not ask for yet.
 *
 * Sequential rather than concurrent: in practice this list holds one round —
 * the partial unique index allows one active round per school — and one queue
 * write at a time is what keeps a longer list from arriving as a burst.
 */
export async function enqueueAiAnalyticsForSupersededRounds(
  supersededRounds: readonly SurveyRound[],
  aiAnalysisRunRepo: IAiAnalysisRunRepository,
  surveyRepo: ISurveyRepository,
): Promise<SupersededRoundDispatch[]> {
  const dispatches: SupersededRoundDispatch[] = [];

  for (const round of supersededRounds) {
    try {
      const outcome = await enqueueAiAnalyticsOnClosure(
        round.id,
        round.privacyThreshold,
        aiAnalysisRunRepo,
        surveyRepo,
      );
      dispatches.push({ roundId: round.id, outcome });
    } catch (error) {
      console.error(
        `Dispatching the analysis for superseded round ${round.id} failed:`,
        error instanceof Error ? error.message : 'unknown error',
      );
      dispatches.push({ roundId: round.id, outcome: 'not_dispatched' });
    }
  }

  return dispatches;
}
