import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import { AnalyticsService } from '@/lib/services';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ roundId: 'round_demo_1' }];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const { roundId } = await params;
    const { roundRepo, surveyRepo } = getRepositories();

    const analytics = await AnalyticsService.getAnalyticsForRound(
      roundId,
      roundRepo,
      surveyRepo
    );

    if (!analytics) {
      return NextResponse.json(
        { error: `Round with ID '${roundId}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ analytics });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch round analytics' },
      { status: 500 }
    );
  }
}
