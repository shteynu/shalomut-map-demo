import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repositories";
import {
  createCanonicalSurveyDefinition,
  hasSameQuestionSnapshot,
  parseSurveyDefinition,
} from "@/lib/survey-definition";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { authorizeManagerRound } from "@/lib/server/manager-scope";

interface RouteParams {
  params: Promise<{ roundId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const { orgRepo, roundRepo } = getRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const { round } = authorization;
    return NextResponse.json({
      definition:
        round.surveyDefinition ??
        createCanonicalSurveyDefinition(round.title, round.privacyThreshold),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch survey definition." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const { orgRepo, roundRepo, surveyRepo } = getRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const parsed = parseSurveyDefinition(await request.json());

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { round } = authorization;
    const responseCount = await surveyRepo.getResponseCount(roundId);
    const currentDefinition =
      round.surveyDefinition ??
      createCanonicalSurveyDefinition(round.title, round.privacyThreshold);
    if (
      responseCount > 0 &&
      !hasSameQuestionSnapshot(currentDefinition, parsed.value)
    ) {
      return NextResponse.json(
        {
          error:
            "Survey question IDs, text, dimensions, order, and enabled state cannot change after the first accepted response. Create a new round for a revised questionnaire.",
        },
        { status: 409 },
      );
    }

    const updated = await roundRepo.update(roundId, {
      title: parsed.value.title,
      privacyThreshold: parsed.value.minimumResponses,
      surveyDefinition: parsed.value,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Survey definition could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      definition: updated.surveyDefinition,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save survey definition." },
      { status: 500 },
    );
  }
}
