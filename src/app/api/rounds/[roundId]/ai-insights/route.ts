import { NextResponse } from 'next/server';
import { validateStoneMapResult } from '@/lib/ai-contract';
import { getRepositories } from '@/lib/repositories';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';

interface RouteParams {
  params: Promise<{
    roundId: string;
  }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const repositories = getRepositories();
    
    const insights = await repositories.roundRepo.getAiInsights(roundId);
    if (!insights) {
      return NextResponse.json(
        { error: 'AI insights not found for this round', roundId },
        { status: 404 }
      );
    }

    return NextResponse.json(insights);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to fetch AI insights: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!hasConfiguredSharedSecret(request, 'AI_CALLBACK_SECRET')) {
      return NextResponse.json(
        { error: 'Unauthorized callback' },
        { status: 401 },
      );
    }

    const { roundId } = await params;
    const payload: unknown = await request.json();
    const validation = validateStoneMapResult(payload, roundId);

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const repositories = getRepositories();
    const saved = await repositories.roundRepo.saveAiInsights(
      roundId,
      validation.value,
    );
    if (!saved) {
      return NextResponse.json(
        { error: 'Survey round not found', roundId },
        { status: 404 },
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `AI insights successfully persisted for round ${roundId}`,
      roundId,
      saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to save AI insights: ${error.message}` },
      { status: 500 }
    );
  }
}
