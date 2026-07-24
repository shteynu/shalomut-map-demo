import { NextResponse } from 'next/server';
import { createSharedSecretHeaders } from '@/lib/server/shared-secret';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateStaticParams() {
  return [
    { roundId: 'SHALOM-DEMO-ROUND-1' },
    { roundId: 'round-unlocked-sample' },
  ];
}

interface RouteParams {
  params: Promise<{
    roundId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000/api/v1/webhook/events';
    const requestOrigin = new URL(request.url).origin;
    const appBaseUrl = (process.env.APP_BASE_URL || requestOrigin).replace(/\/$/, '');

    const webhookPayload = {
      event: 'round_closed',
      roundId,
      callbackUrl: `${appBaseUrl}/api/rounds/${roundId}/ai-insights`,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch(aiServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...createSharedSecretHeaders('AI_WEBHOOK_SECRET'),
        },
        body: JSON.stringify(webhookPayload),
      });

      const serviceResponse = await response
        .json()
        .catch(() => ({ status: response.ok ? 'accepted' : 'error' }));

      if (!response.ok) {
        return NextResponse.json(
          {
            status: 'upstream_error',
            roundId,
            upstreamStatus: response.status,
            serviceResponse,
          },
          { status: 502 },
        );
      }

      return NextResponse.json(
        {
          status: 'accepted',
          roundId,
          webhookPayload,
          serviceResponse,
        },
        { status: 202 },
      );
    } catch (error: any) {
      return NextResponse.json(
        {
          status: 'unavailable',
          roundId,
          error: `AI analytics service unavailable: ${error.message}`,
        },
        { status: 503 },
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to trigger AI analytics: ${error.message}` },
      { status: 500 }
    );
  }
}
