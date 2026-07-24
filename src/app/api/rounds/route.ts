import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import { ManagerContextService, RoundService } from '@/lib/services';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { CreateRoundInput } from '@/lib/types/backend';

export async function GET(request?: Request) {
  try {
    const { orgRepo, roundRepo, surveyRepo } = getRepositories();
    const roundId = request
      ? new URL(request.url).searchParams.get('roundId')?.trim()
      : undefined;
    const round = roundId
      ? await roundRepo.findById(roundId)
      : (
          await ManagerContextService.load(orgRepo, roundRepo, surveyRepo)
        ).currentRound;

    return NextResponse.json({ round });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch round' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const body = (await request.json()) as CreateRoundInput;
    if (!body.organizationId || !body.title) {
      return NextResponse.json(
        { error: 'organizationId and title are required' },
        { status: 400 }
      );
    }

    const { roundRepo } = getRepositories();
    const round = await RoundService.createAndSaveRound(body, roundRepo);
    return NextResponse.json({ success: true, round }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create survey round' },
      { status: 500 }
    );
  }
}
