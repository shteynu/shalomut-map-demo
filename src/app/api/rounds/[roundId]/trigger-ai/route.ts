import { NextResponse } from 'next/server';
import { createSharedSecretHeaders } from '@/lib/server/shared-secret';
import { triggerAiAnalyticsForRound } from '@/lib/server/trigger-ai-analytics';
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

    const result = await triggerAiAnalyticsForRound(roundId);

    if (!result.ok) {
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
        webhookPayload: {
          event: 'round_closed',
          roundId,
          timestamp: new Date().toISOString(),
        },
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
