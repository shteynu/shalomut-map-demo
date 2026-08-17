import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import {
  RoundService,
  SurveyService,
  SURVEY_SUBMISSION_ERROR_STATUS,
} from '@/lib/services';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { getRateLimitResponse, RATE_LIMITS } from '@/lib/server/rate-limit';
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

/**
 * Twelve hours, matching the database's own check constraint.
 *
 * The client caps to the same figure, which is why this is not a duplicate: the
 * client is not the thing being trusted here. This endpoint is the only
 * unauthenticated write in the product.
 */
const MAX_VISIBLE_SECONDS = 12 * 60 * 60;

/**
 * How long the questionnaire was visible, or nothing.
 *
 * Dropped rather than refused. The answers are what the respondent came to
 * send, and a malformed timing figure — an old client, a hand-made request, a
 * clock that ran backwards — must never cost them their submission. Dropping it
 * lands the response in the report's "not measured" bucket, which is a state
 * the report already states out loud; refusing the whole request would turn a
 * decoration into a gate.
 *
 * It is not coerced, though. `Number(value)` on a string or a boolean would
 * write a figure the respondent's browser never counted.
 */
function readVisibleSeconds(value: unknown): number | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > MAX_VISIBLE_SECONDS
  ) {
    return undefined;
  }

  return value;
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
    const { answers, anonymousTokenHash, visibleSeconds } = body as {
      answers: QuestionAnswerInput[];
      anonymousTokenHash?: string;
      visibleSeconds?: unknown;
    };

    const { roundRepo, surveyAttemptRepo, surveyRepo } =
      resolveCoreRepositories();
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
        visibleSeconds: readVisibleSeconds(visibleSeconds),
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

    /*
     * A submission no longer dispatches an analysis. Until 2026-08-17 it did,
     * once the round crossed its privacy threshold and then again whenever a
     * later answer invalidated the run in flight, and the school's map moved
     * under it while collection was still open. Analysis now belongs to the
     * moment a manager closes the round — see the PATCH handler in
     * `api/rounds/[roundId]` — so nothing here reaches the provider, and a
     * respondent's request ends where their answers are stored.
     */
    return NextResponse.json({ success: true, responseId: result.responseId }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process survey submission' },
      { status: 500 }
    );
  }
}
