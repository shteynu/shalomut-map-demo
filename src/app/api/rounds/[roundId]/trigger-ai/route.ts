import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import { getArchivedRoundGuardResponse } from '@/lib/server/archived-round-guard';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { recordAiJobQueued } from '@/lib/server/ai-operational-metrics';
import { authorizeManagerRound } from '@/lib/server/manager-scope';
import { getPrivacyThresholdGuardResponse } from '@/lib/server/privacy-threshold-guard';

interface RouteParams {
  params: Promise<{
    roundId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const { aiAnalysisRunRepo, orgRepo, roundRepo, surveyRepo } =
      resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    // A new run would overwrite the stored analysis of a round the school has
    // already filed, and the map that names it in a comparison would change
    // underneath.
    const archived = getArchivedRoundGuardResponse(authorization.round);
    if (archived) return archived;

    // The threshold is checked here rather than trusted from the screen: the
    // button that used to be the only thing standing between nine responses
    // and a dispatched analysis is markup, and this route is reachable without
    // it.
    const belowThreshold = await getPrivacyThresholdGuardResponse(
      authorization.round,
      surveyRepo,
    );
    if (belowThreshold) return belowThreshold;

    const enqueued = await aiAnalysisRunRepo.enqueue(roundId, {
      requestKey: `manual:${globalThis.crypto.randomUUID()}`,
      trigger: 'manual',
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
