import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import { RoundService } from '@/lib/services';
import { surveyInstrument } from '@/lib/shalomut-source';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const { shareCode } = await params;
    const { roundRepo } = getRepositories();
    const round = await RoundService.getRoundByShareCode(shareCode, roundRepo);

    if (!round) {
      return NextResponse.json(
        { error: `Survey round with code '${shareCode}' not found` },
        { status: 404 }
      );
    }

    if (round.status !== 'active') {
      return NextResponse.json(
        { error: `Survey round '${round.title}' is not active (status: ${round.status})` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      round,
      instrument: {
        title: surveyInstrument.title,
        dimensions: surveyInstrument.dimensions,
        questions: surveyInstrument.questions,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch survey metadata' },
      { status: 500 }
    );
  }
}
