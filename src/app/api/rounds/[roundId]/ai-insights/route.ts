import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';

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
    const { roundId } = await params;
    const payload = await request.json();

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const repositories = getRepositories();
    const saved = await repositories.roundRepo.saveAiInsights(roundId, payload);

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
