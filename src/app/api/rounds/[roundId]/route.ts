import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { RoundService } from "@/lib/services";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { authorizeManagerRound } from "@/lib/server/manager-scope";
import type { RoundStatus } from "@/lib/types/backend";
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from "@/lib/survey-definition";

const validStatuses: RoundStatus[] = [
  "draft",
  "active",
  "closed",
  "archived",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const { orgRepo, roundRepo } = resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const body = (await request.json()) as { status?: unknown };
    if (
      typeof body.status !== "string" ||
      !validStatuses.includes(body.status as RoundStatus)
    ) {
      return NextResponse.json(
        { error: "A valid round status is required." },
        { status: 400 },
      );
    }

    const { round } = authorization;

    const targetStatus = body.status as RoundStatus;
    if (!RoundService.isTransitionAllowed(round.status, targetStatus)) {
      return NextResponse.json(
        {
          error: `Transition from '${round.status}' to '${targetStatus}' is not allowed.`,
        },
        { status: 409 },
      );
    }

    if (targetStatus === "active") {
      const definition =
        round.surveyDefinition ??
        createCanonicalSurveyDefinition(round.title, round.privacyThreshold);
      const parsedDefinition = parseSurveyDefinition(definition);
      if (!parsedDefinition.ok) {
        return NextResponse.json(
          {
            error: `Survey round cannot be activated: ${parsedDefinition.error}`,
          },
          { status: 409 },
        );
      }
    }

    const updated = await roundRepo.updateStatus(roundId, targetStatus);
    return NextResponse.json({ success: true, round: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update survey round." },
      { status: 500 },
    );
  }
}
