import { NextResponse } from 'next/server';
import { resolveCoreRepositories } from '@/lib/composition-root';
import { RoundService } from '@/lib/services';
import { surveyInstrument } from '@/lib/shalomut-source';
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from '@/lib/survey-definition';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const { shareCode } = await params;
    const { roundRepo } = resolveCoreRepositories();
    const round = await RoundService.getRoundByShareCode(shareCode, roundRepo);

    if (!round) {
      return NextResponse.json(
        { error: `Survey round with code '${shareCode}' not found` },
        { status: 404 }
      );
    }

    if (round.status !== 'active') {
      // The title is the school's own wording and named the round to anyone
      // scanning share codes, which turned a 400 into a school-name harvester.
      // The status is what a respondent's client can act on; the title is not.
      return NextResponse.json(
        { error: `Survey round is not active (status: ${round.status})` },
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
    const definition = parsedDefinition.value;

    return NextResponse.json({
      /*
       * A whitelist, not the round. This route is the one endpoint that must
       * answer an unauthenticated caller holding only a share code, and it used
       * to return the whole domain object — which carries `backgroundContext`
       * (sickness days, staff turnover, socio-economic index and the manager's
       * free-text notes about the school) along with the organization id and
       * the internal round id. A respondent screen renders none of that. Add a
       * field here only when a respondent's client cannot work without it.
       */
      round: {
        shareCode: round.shareCode,
        title: round.title,
        status: round.status,
        privacyThreshold: round.privacyThreshold,
      },
      instrument: {
        title: definition.title,
        introText: definition.introText,
        anonymityText: definition.anonymityText,
        dimensions: surveyInstrument.dimensions,
        questions: definition.questions.filter((question) => question.enabled),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch survey metadata' },
      { status: 500 }
    );
  }
}
