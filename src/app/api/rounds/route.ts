import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import { RoundService } from '@/lib/services';
import { CreateRoundInput } from '@/lib/types/backend';

export const dynamic = 'force-static';

export async function GET() {
  try {
    const { roundRepo } = getRepositories();
    const defaultRound = await roundRepo.findById('round_demo_1');
    return NextResponse.json({ round: defaultRound });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch round' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
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
