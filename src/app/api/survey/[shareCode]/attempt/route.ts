import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/server/rate-limit';
import { RoundService, SurveyFunnelService } from '@/lib/services';

/**
 * Where one filling session got to.
 *
 * Unauthenticated by necessity — it sits beside the questionnaire on the only
 * public route the product has — and deliberately uninformative in reply. It
 * answers `204` to everything it accepts and to everything it refuses for a
 * reason the caller could learn by guessing: a share code that does not exist
 * and a share code whose round has closed produce the same empty answer, so
 * this endpoint cannot become the share-code oracle the questionnaire endpoint
 * used to be.
 *
 * The client fires it and does not wait, so nothing here may block a
 * respondent: an error is swallowed into the same `204`. Losing a beacon costs
 * one row's precision in a funnel, and it must never cost a teacher their
 * place in the questionnaire.
 */
function accepted() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareCode: string }> },
) {
  try {
    const { shareCode } = await params;

    // Refused the same way as everything else here: silently, with the same
    // `204`. A 429 would tell a caller probing the funnel exactly where the
    // ceiling is, and the real client does not read the reply at all.
    const decision = await consumeRateLimit(
      request.headers,
      RATE_LIMITS.surveyAttemptBeacon,
    );
    if (!decision.allowed) return accepted();

    const body = (await request.json().catch(() => null)) as {
      anonymousTokenHash?: unknown;
      stage?: unknown;
      lastQuestionReached?: unknown;
    } | null;

    if (!body) return accepted();

    const { anonymousTokenHash, stage, lastQuestionReached } = body;

    // The hash is a client-computed SHA-256 hex string; anything else is not a
    // key this table can dedupe on, and a row per malformed value is exactly
    // how a funnel stops meaning anything.
    if (
      typeof anonymousTokenHash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(anonymousTokenHash)
    ) {
      return accepted();
    }
    if (!SurveyFunnelService.isClientStage(stage)) return accepted();

    const { roundRepo, surveyAttemptRepo } = resolveCoreRepositories();
    const round = await RoundService.getRoundByShareCode(shareCode, roundRepo);

    // Only a round that is collecting has a funnel worth recording, and this is
    // also what stops a closed round's rows growing from an old open tab.
    if (!round || round.status !== 'active') return accepted();

    await SurveyFunnelService.record(
      {
        roundId: round.id,
        anonymousTokenHash,
        stage,
        lastQuestionReached: SurveyFunnelService.isQuestionIndex(
          lastQuestionReached,
        )
          ? lastQuestionReached
          : undefined,
      },
      surveyAttemptRepo,
    );

    return accepted();
  } catch (error) {
    console.error(
      'Recording a survey attempt failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return accepted();
  }
}
