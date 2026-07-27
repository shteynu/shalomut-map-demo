import { NextResponse } from 'next/server';
import {
  AI_RUN_CLAIM_LEASE_MS,
  triggerAiAnalyticsForRound,
} from '@/lib/server/trigger-ai-analytics';
import { getRepositories } from '@/lib/repositories';
import { authorizeManagerRound } from '@/lib/server/manager-scope';

interface RouteParams {
  params: Promise<{
    roundId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const { orgRepo, roundRepo } = getRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    // A manual rerun may regenerate an existing result, but it still takes the
    // dispatch claim so a double click or a concurrent automatic trigger cannot
    // start two provider runs for the same round.
    const claimed = await roundRepo.claimAiAnalysisRun(roundId, {
      leaseMs: AI_RUN_CLAIM_LEASE_MS,
      requireNoInsights: false,
    });

    if (!claimed) {
      return NextResponse.json(
        {
          status: 'already_running',
          roundId,
          error:
            'An AI analytics run for this round was dispatched moments ago. Wait for it to finish before starting another one.',
        },
        { status: 409 },
      );
    }

    const result = await triggerAiAnalyticsForRound(roundId);

    if (!result.ok) {
      // A failed dispatch must not hold the round hostage until the lease
      // expires: the manager should be able to retry as soon as the service is
      // back.
      await roundRepo.releaseAiAnalysisClaim(roundId);

      const httpStatus =
        result.status === 'upstream_error'
          ? 502
          : result.status === 'timeout'
          ? 504
          : 503;

      return NextResponse.json(
        {
          status: result.status,
          roundId,
          upstreamStatus: result.upstreamStatus,
          serviceResponse: result.serviceResponse,
          error: result.error,
        },
        { status: httpStatus },
      );
    }

    return NextResponse.json(
      {
        status: 'accepted',
        roundId,
        webhookPayload: result.webhookPayload,
        serviceResponse: result.serviceResponse,
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
