import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import {
  RoundService,
  SurveyService,
  SURVEY_SUBMISSION_ERROR_STATUS,
} from '@/lib/services';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { getRateLimitResponse, RATE_LIMITS } from '@/lib/server/rate-limit';
import { enqueueAiAnalyticsAfterResponse } from '@/lib/server/trigger-ai-analytics';
import {
  QuestionAnswerInput,
  SurveySubmissionErrorCode,
} from '@/lib/types/backend';
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from '@/lib/survey-definition';

/**
 * Every refusal the respondent client can act on carries its reason. The status
 * comes from the shared table rather than from this handler, so the route and
 * `docs/openapi.yaml` cannot drift into disagreeing about what a duplicate is.
 */
function refuse(code: SurveySubmissionErrorCode, error: string) {
  return NextResponse.json(
    { error, code },
    { status: SURVEY_SUBMISSION_ERROR_STATUS[code] },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    /*
     * The only unauthenticated write in the product, so it is the one a script
     * can point at. The number is loose on purpose — a whole staffroom answers
     * from one school address, and refusing them would be a worse failure than
     * the one being prevented. `RATE_LIMITS.surveySubmission` carries the
     * reasoning.
     */
    const limited = await getRateLimitResponse(
      request.headers,
      RATE_LIMITS.surveySubmission,
    );
    if (limited) return limited;

    const { shareCode } = await params;
    const body = await request.json();
    const { answers, anonymousTokenHash } = body as {
      answers: QuestionAnswerInput[];
      anonymousTokenHash?: string;
    };

    const {
      aiAnalysisRunRepo,
      aiInsightsRepo,
      roundRepo,
      surveyAttemptRepo,
      surveyRepo,
    } = resolveCoreRepositories();
    const round = await RoundService.getRoundByShareCode(shareCode, roundRepo);

    if (!round) {
      return refuse(
        'ROUND_NOT_FOUND',
        `Survey round with code '${shareCode}' not found`,
      );
    }

    if (round.status !== 'active') {
      return refuse('ROUND_NOT_ACTIVE', `Survey round is not active`);
    }

    const definitionCandidate =
      round.surveyDefinition ??
      createCanonicalSurveyDefinition(round.title, round.privacyThreshold);
    const parsedDefinition = parseSurveyDefinition(definitionCandidate);
    if (!parsedDefinition.ok) {
      return refuse(
        'DEFINITION_INVALID',
        `Survey definition is invalid: ${parsedDefinition.error}`,
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
      const error = result.error || 'Submission failed';

      // A refusal the service could not name stays a plain 400 without a code:
      // inventing one would tell the client a story the server does not know.
      return result.code
        ? refuse(result.code, error)
        : NextResponse.json({ error }, { status: 400 });
    }

    /*
     * The funnel's completion is written here rather than by the client,
     * because a response is the durable fact and a beacon is not. It follows
     * the response so a failure to close the funnel row can never cost the
     * answers themselves — the manager would read one abandoned session that
     * was not abandoned, which is a wrong number rather than a lost one.
     */
    if (anonymousTokenHash) {
      try {
        await surveyAttemptRepo.markCompleted(round.id, anonymousTokenHash);
      } catch (error) {
        console.error(
          'Marking the survey attempt complete failed:',
          error instanceof Error ? error.message : 'unknown error',
        );
      }
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
