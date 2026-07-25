import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import { AnalyticsService } from '@/lib/services';
import { authorizeManagerRound } from '@/lib/server/manager-scope';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    const { roundId } = await params;
    const { orgRepo, roundRepo, surveyRepo } = getRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

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
