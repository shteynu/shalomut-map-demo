import { NextResponse } from 'next/server';
import { getRepositories } from '@/lib/repositories';
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
      round,
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
