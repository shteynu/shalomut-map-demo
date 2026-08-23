import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { authorizeManagerRound } from "@/lib/server/manager-scope";

interface RouteParams {
  params: Promise<{ roundId: string; versionId: string }>;
}

/**
 * One earlier questionnaire, whole.
 *
 * There is deliberately no restore endpoint. Restoring is saving an earlier
 * definition, so the builder reads this and sends it back through
 * `PUT /api/rounds/{roundId}/survey-definition` — which means a restore passes
 * the same validation, the same "questions are frozen after the first response"
 * refusal and the same activation rule as any other save, instead of a second
 * write path that has to remember all three.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId, versionId } = await params;
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

    const version = await surveyDefinitionVersionRepo.findById(
      roundId,
      versionId,
    );
    if (!version) {
      return NextResponse.json(
        { error: "This round has no such questionnaire version." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: version.id,
      savedAt: version.savedAt.toISOString(),
      definition: version.definition,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch the questionnaire version." },
      { status: 500 },
    );
  }
}
