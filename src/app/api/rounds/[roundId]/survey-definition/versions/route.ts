import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { authorizeManagerRound } from "@/lib/server/manager-scope";
import { markCurrentVersion } from "@/lib/survey-definition-versions";

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
 *
 * That used to be true of the response and not of the query: the definitions
 * were read out of the database in full and then discarded here. The store now
 * summarises them where they are.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const { auditLogRepo, orgRepo, roundRepo, surveyDefinitionVersionRepo } =
      resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
      auditLogRepo,
      "read:survey-definition",
    );
    if (!authorization.ok) return authorization.response;

    const versions =
      await surveyDefinitionVersionRepo.findSummariesByRoundId(roundId);
    return NextResponse.json({ versions: markCurrentVersion(versions) });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch the questionnaire history." },
      { status: 500 },
    );
  }
}
