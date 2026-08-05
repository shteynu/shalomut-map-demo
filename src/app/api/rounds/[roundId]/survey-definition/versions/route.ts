import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { authorizeManagerRound } from "@/lib/server/manager-scope";
import { toVersionSummaries } from "@/lib/survey-definition-versions";

interface RouteParams {
  params: Promise<{ roundId: string }>;
}

/**
 * The questionnaire's history for one round, newest first.
 *
 * Summaries rather than definitions: the list exists so a manager can
 * recognise which save to go back to, and shipping twenty full questionnaires
 * to render a list of dates would be paying for nineteen nobody opens. The one
 * they choose is fetched by id.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const { orgRepo, roundRepo, surveyDefinitionVersionRepo } =
      resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const versions = await surveyDefinitionVersionRepo.findByRoundId(roundId);
    return NextResponse.json({ versions: toVersionSummaries(versions) });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch the questionnaire history." },
      { status: 500 },
    );
  }
}
