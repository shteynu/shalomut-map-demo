import { NextResponse, after } from 'next/server';
import { getRepositories } from '@/lib/repositories';
import { RoundService, SurveyService } from '@/lib/services';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { dispatchAiAnalyticsAfterResponse } from '@/lib/server/trigger-ai-analytics';
import { QuestionAnswerInput } from '@/lib/types/backend';
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from '@/lib/survey-definition';

/**
 * Runs background work after the response is sent. `after` keeps the serverless
 * invocation alive until the work settles; outside a Next request scope (unit
 * tests, non-Next runtimes) it throws, so the work runs detached instead.
 */
function scheduleAiAnalyticsDispatch(work: () => Promise<unknown>) {
  const guarded = async () => {
    try {
      await work();
    } catch (error) {
      console.error(
        'Auto-trigger AI analytics failed:',
        error instanceof Error ? error.message : 'unknown error',
      );
    }
  };

  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

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

    // Auto-trigger AI analytics once the round reaches its privacy threshold.
    // The respondent never waits for it, but the work must outlive the response
    // on a serverless runtime, so it is scheduled with `after` rather than a
    // detached promise the platform is free to kill.
    scheduleAiAnalyticsDispatch(() =>
      dispatchAiAnalyticsAfterResponse(
        round.id,
        round.privacyThreshold,
        roundRepo,
        surveyRepo,
      ),
    );

    return NextResponse.json({ success: true, responseId: result.responseId }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process survey submission' },
      { status: 500 }
    );
  }
}
