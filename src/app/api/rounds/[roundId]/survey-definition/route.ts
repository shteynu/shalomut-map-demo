import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { RoundService } from "@/lib/services";
import {
  createCanonicalSurveyDefinition,
  hasSameQuestionSnapshot,
  isActivatableSurveyDefinition,
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
    const { orgRepo, roundRepo } = resolveCoreRepositories();
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
    const { orgRepo, roundRepo, surveyRepo } = resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const parsed = parseSurveyDefinition(await request.json(), {
      allowIncomplete: true,
    });

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

    // A draft round goes live as soon as its questionnaire covers all eight
    // dimensions, and going live closes whichever round the school was running.
    // Closed and archived rounds are never reopened here.
    let closedRoundTitles: string[] = [];
    if (
      updated &&
      updated.status === 'draft' &&
      isActivatableSurveyDefinition(parsed.value)
    ) {
      const activation = await RoundService.activateRound(roundId, roundRepo);
      closedRoundTitles =
        activation?.closedRounds.map((round) => round.title) ?? [];
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Survey definition could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      // When the write completed, as the server saw it. The builder shows this
      // rather than the moment the button was pressed.
      savedAt: new Date().toISOString(),
      definition: updated.surveyDefinition,
      // Named so the builder can tell the manager which round stopped running,
      // rather than leaving the school to notice on the dashboard later.
      closedRoundTitles,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save survey definition." },
      { status: 500 },
    );
  }
}
