import { NextResponse } from 'next/server';

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

    const webhookPayload = {
      event: 'round_closed',
      roundId,
      callbackUrl: `http://localhost:3000/api/rounds/${roundId}/ai-insights`,
      timestamp: new Date().toISOString(),
    };

    let serviceResponseStatus = 200;
    let serviceResponseData: any = { message: 'Webhook triggered locally / mock dispatch' };

    try {
      const response = await fetch(aiServiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      serviceResponseStatus = response.status;
      serviceResponseData = await response.json().catch(() => ({ status: 'accepted' }));
    } catch (e: any) {
      // Graceful offline fallback during development / static builds
      serviceResponseData = {
        status: 'queued_offline',
        note: `AI microservice offline at ${aiServiceUrl}, webhook payload generated successfully.`,
      };
    }

    return NextResponse.json({
      status: 'success',
      roundId,
      webhookPayload,
      serviceResponse: serviceResponseData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to trigger AI analytics: ${error.message}` },
      { status: 500 }
    );
  }
}
