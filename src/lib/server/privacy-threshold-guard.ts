import { NextResponse } from "next/server";
import type { ISurveyRepository } from "@/lib/repositories/interfaces";
import { effectivePrivacyThreshold } from "@/lib/survey-definition";
import type { SurveyRound } from "@/lib/types/backend";

/**
 * No round below its privacy threshold may have its aggregates dispatched.
 *
 * This check existed before this module did, but in exactly one place —
 * `enqueueAiAnalyticsAfterResponse`, on the automatic path that ran after every
 * respondent submission. The manual route beside it checked authorization and
 * the archive and never checked the threshold at all, so what actually stopped
 * a manager pressing "analyse" on nine responses was a `disabled` attribute on
 * a button. Markup is not an invariant: the route is reachable without the
 * screen.
 *
 * Moving analysis to the moment a round closes removes the automatic path, and
 * with it the only server-side check on the whole dispatch path. So the check
 * moves here first, before anything is deleted, and both entrances use it.
 *
 * `409`, not `403`, for the same reason the archived guard gives: the request
 * is authorized and well formed, and what refuses it is the state of the round.
 * The message names the threshold and not the count — a manager reads their own
 * count on their own screen, and this sentence should stay true whichever
 * number the round is currently at.
 */
export async function getPrivacyThresholdGuardResponse(
  round: Pick<SurveyRound, "id" | "privacyThreshold">,
  surveyRepo: ISurveyRepository,
) {
  const threshold = effectivePrivacyThreshold(round.privacyThreshold);
  const responseCount = await surveyRepo.getResponseCount(round.id);
  if (responseCount >= threshold) return null;

  return NextResponse.json(
    {
      error:
        `This round has fewer than ${threshold} responses. Analysis stays ` +
        `unavailable until the privacy threshold is reached, so that no result ` +
        `can describe an individual.`,
      code: "below_privacy_threshold",
    },
    { status: 409 },
  );
}
