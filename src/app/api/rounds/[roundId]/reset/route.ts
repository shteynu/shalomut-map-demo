import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repositories";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { authorizeManagerRound } from "@/lib/server/manager-scope";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
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

    // Delete all survey responses associated with this round
    await surveyRepo.deleteByRoundId(roundId);

    // Re-set round status to draft to allow question re-editing
    const updatedRound = await roundRepo.updateStatus(roundId, "draft");

    return NextResponse.json({
      success: true,
      message: "Round data reset successfully.",
      round: updatedRound,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to reset round responses." },
      { status: 500 },
    );
  }
}
