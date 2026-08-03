import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import { RoundService, SurveyService } from '@/lib/services';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { enqueueAiAnalyticsAfterResponse } from '@/lib/server/trigger-ai-analytics';
import { QuestionAnswerInput } from '@/lib/types/backend';
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from '@/lib/survey-definition';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { shareCode } = await params;
    const body = await request.json();
    const { answers, anonymousTokenHash } = body as {
      answers: QuestionAnswerInput[];
      anonymousTokenHash?: string;
    };

    const { aiAnalysisRunRepo, aiInsightsRepo, roundRepo, surveyRepo } =
      resolveCoreRepositories();
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

    const definitionCandidate =
      round.surveyDefinition ??
      createCanonicalSurveyDefinition(round.title, round.privacyThreshold);
    const parsedDefinition = parseSurveyDefinition(definitionCandidate);
    if (!parsedDefinition.ok) {
      return NextResponse.json(
        { error: `Survey definition is invalid: ${parsedDefinition.error}` },
        { status: 409 },
      );
    }

    const result = await SurveyService.submitAndSaveResponse(
      {
        roundId: round.id,
        answers,
        anonymousTokenHash,
      },
      surveyRepo,
      parsedDefinition.value.questions.filter((question) => question.enabled)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Submission failed' },
        { status: 400 }
      );
    }

    // Enqueue before returning so a process restart cannot lose the threshold
    // event. Analysis itself remains asynchronous and never runs in the
    // respondent request.
    try {
      await enqueueAiAnalyticsAfterResponse(
        round.id,
        round.privacyThreshold,
        aiAnalysisRunRepo,
        aiInsightsRepo,
        surveyRepo,
      );
    } catch (error) {
      // The response has already been persisted. Do not make the respondent
      // resubmit; the manager trigger remains a safe recovery path.
      console.error(
        'Auto-enqueue AI analytics failed:',
        error instanceof Error ? error.message : 'unknown error',
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
