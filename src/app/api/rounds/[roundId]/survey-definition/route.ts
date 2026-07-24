import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repositories";
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from "@/lib/survey-definition";

interface RouteParams {
  params: Promise<{ roundId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { roundId } = await params;
  const { roundRepo } = getRepositories();
  const round = await roundRepo.findById(roundId);

  if (!round) {
    return NextResponse.json({ error: "Survey round not found." }, { status: 404 });
  }

  return NextResponse.json({
    definition:
      round.surveyDefinition ??
      createCanonicalSurveyDefinition(round.title, round.privacyThreshold),
  });
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const parsed = parseSurveyDefinition(await request.json());

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { roundRepo } = getRepositories();
    const round = await roundRepo.findById(roundId);
    if (!round) {
      return NextResponse.json(
        { error: "Survey round not found." },
        { status: 404 },
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
