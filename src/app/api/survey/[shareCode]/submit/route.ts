import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import { RoundService, SurveyService } from '@/lib/services';
import { QuestionAnswerInput } from '@/lib/types/backend';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ shareCode: 'SHALOM-DEMO' }];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const { shareCode } = await params;
    const body = await request.json();
    const { answers, anonymousTokenHash } = body as {
      answers: QuestionAnswerInput[];
      anonymousTokenHash?: string;
    };

    const { roundRepo, surveyRepo } = getRepositories();
    const round = await RoundService.getRoundByShareCode(shareCode, roundRepo);

    if (!round) {
      return NextResponse.json(
        { error: `Survey round with code '${shareCode}' not found` },
        { status: 404 }
      );
    }

    if (round.status !== 'active') {
      return NextResponse.json(
        { error: `Survey round is not active` },
        { status: 400 }
      );
    }

    const result = await SurveyService.submitAndSaveResponse(
      {
        roundId: round.id,
        answers,
        anonymousTokenHash,
      },
      surveyRepo
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Submission failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, responseId: result.responseId }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process survey submission' },
      { status: 500 }
    );
  }
}
