import { NextResponse } from 'next/server';
import { AI_ANALYTICS_DIMENSION_IDS } from '@/lib/ai-contract';
import { resolveCoreRepositories } from '@/lib/composition-root';
import { getArchivedRoundGuardResponse } from '@/lib/server/archived-round-guard';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { recordAiJobQueued } from '@/lib/server/ai-operational-metrics';
import { recordRoundAuditEvent } from '@/lib/server/manager-audit';
import { authorizeManagerRound } from '@/lib/server/manager-scope';
import { getPrivacyThresholdGuardResponse } from '@/lib/server/privacy-threshold-guard';

interface RouteParams {
  params: Promise<{
    roundId: string;
  }>;
}

/**
 * Which dimensions this request asks to be written again.
 *
 * An absent body, an absent field and an empty list all mean the same thing —
 * the whole round — because that is what every caller of this route meant
 * before the field existed, and a screen that posts nothing must keep working.
 *
 * Names are checked against the contract's own eight rather than against a
 * list repeated here. An unknown name is refused rather than dropped: a
 * request naming a dimension that does not exist has misunderstood something,
 * and quietly analysing the whole round instead would spend a full round's
 * provider calls answering a question nobody asked.
 */
function readRequestedDimensions(
  body: unknown,
): { ok: true; dimensionIds: string[] } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || !('dimensionIds' in body)) {
    return { ok: true, dimensionIds: [] };
  }

  const requested = (body as { dimensionIds?: unknown }).dimensionIds;
  if (requested === undefined || requested === null) {
    return { ok: true, dimensionIds: [] };
  }
  if (
    !Array.isArray(requested) ||
    requested.some((value) => typeof value !== 'string')
  ) {
    return { ok: false, error: 'dimensionIds must be an array of strings' };
  }

  const unknown = requested.filter(
    (value) => !AI_ANALYTICS_DIMENSION_IDS.includes(value),
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown dimension ids: ${unknown.join(', ')}`,
    };
  }

  // Canonical order and no repeats, so the stored list reads the same however
  // the caller wrote it and cannot ask for one dimension twice.
  return {
    ok: true,
    dimensionIds: AI_ANALYTICS_DIMENSION_IDS.filter((dimensionId) =>
      requested.includes(dimensionId),
    ),
  };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const requested = readRequestedDimensions(
      await request.clone().json().catch(() => null),
    );
    if (!requested.ok) {
      return NextResponse.json({ error: requested.error }, { status: 400 });
    }

    const { aiAnalysisRunRepo, auditLogRepo, orgRepo, roundRepo, surveyRepo } =
      resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
      auditLogRepo,
    );
    if (!authorization.ok) return authorization.response;

    // A new run would overwrite the stored analysis of a round the school has
    // already filed, and the map that names it in a comparison would change
    // underneath.
    const archived = getArchivedRoundGuardResponse(authorization.round);
    if (archived) return archived;

    /*
     * This route is the second opinion, not the first. Closing a round is what
     * asks for its analysis (owner decision 2026-08-17), and a round still
     * collecting has not asked yet — analysing it here would put a map in front
     * of the school built from a sample that is still moving, which is the
     * behaviour that decision removed.
     *
     * Enforced at the route rather than by disabling buttons, because there are
     * two screens offering this and the rule has to be the same on both. A
     * draft has no answers to analyse and falls out here too.
     */
    if (authorization.round.status !== "closed") {
      return NextResponse.json(
        {
          error:
            "Analysis runs when a round is closed. Close the round to have it analysed; this route re-runs the analysis of a round that is already closed.",
          code: "round_not_closed",
        },
        { status: 409 },
      );
    }

    // The threshold is checked here rather than trusted from the screen: the
    // button that used to be the only thing standing between nine responses
    // and a dispatched analysis is markup, and this route is reachable without
    // it.
    const belowThreshold = await getPrivacyThresholdGuardResponse(
      authorization.round,
      surveyRepo,
    );
    if (belowThreshold) return belowThreshold;

    /*
     * A partial run amends a map; without one there is nothing to amend.
     *
     * Refused rather than widened to a full round: the only screen that asks
     * for this asks from a note about paragraphs that already exist, so an
     * empty round means the state changed under the manager — a reset, or an
     * analysis that never landed. Spending a whole round's provider calls to
     * paper over that would answer a question nobody asked, and the manager
     * still has the button that does ask it.
     */
    if (requested.dimensionIds.length > 0) {
      const previous = await aiAnalysisRunRepo.findLatestResultByRoundId(
        roundId,
      );
      if (!previous) {
        return NextResponse.json(
          {
            error:
              'This round has no stored analysis to amend. Run the full analysis first.',
            code: 'no_previous_analysis',
          },
          { status: 409 },
        );
      }
    }

    const enqueued = await aiAnalysisRunRepo.enqueue(roundId, {
      requestKey: `manual:${globalThis.crypto.randomUUID()}`,
      trigger: 'manual',
      regenerateDimensionIds: requested.dimensionIds,
    });

    if (enqueued.outcome === 'already_active') {
      return NextResponse.json(
        {
          status: 'already_running',
          roundId,
          error:
            'An AI analytics run for this round is already queued or running. Wait for it to finish before starting another one.',
        },
        { status: 409 },
      );
    }

    if (enqueued.outcome === 'enqueued') {
      recordAiJobQueued(enqueued.run);
      await recordRoundAuditEvent(
        auditLogRepo,
        request,
        'AI_TRIGGERED',
        roundId,
        authorization.round.organizationId,
        {
          runId: enqueued.run.id,
          regenerateDimensionIds: enqueued.run.regenerateDimensionIds,
        },
      );
    }

    return NextResponse.json(
      {
        status: 'queued',
        roundId,
        run: {
          id: enqueued.run.id,
          roundId: enqueued.run.roundId,
          state: enqueued.run.state,
          queuedAt: enqueued.run.queuedAt.toISOString(),
          regenerateDimensionIds: enqueued.run.regenerateDimensionIds,
        },
      },
      { status: 202 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to trigger AI analytics: ${error.message}` },
      { status: 500 }
    );
  }
}
