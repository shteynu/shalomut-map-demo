import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { getArchivedRoundGuardResponse } from "@/lib/server/archived-round-guard";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { authorizeManagerRound } from "@/lib/server/manager-scope";
import { recordRoundAuditEvent } from "@/lib/server/manager-audit";
import { describeRefusedStatusWrite } from "@/lib/server/round-status-write";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const {
      aiAnalysisRunRepo,
      aiInsightsRepo,
      auditLogRepo,
      orgRepo,
      roundGoalRepo,
      roundRepo,
      surveyAttemptRepo,
      surveyRepo,
    } = resolveCoreRepositories();

    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
      auditLogRepo,
    );
    if (!authorization.ok) return authorization.response;

    // Reset ends by writing `draft`, which is not a transition the status table
    // allows out of `archived` — and it wrote it directly, so nothing refused
    // it. Refusing here keeps the archive terminal.
    const archived = getArchivedRoundGuardResponse(authorization.round);
    if (archived) return archived;

    // Reset is irreversible, so the number of responses about to be destroyed
    // is captured before the delete and recorded in the audit trail.
    const deletedResponseCount = await surveyRepo.getResponseCount(roundId);

    // Delete all survey responses associated with this round
    await surveyRepo.deleteByRoundId(roundId);

    // The funnel describes how those responses were arrived at, so it goes with
    // them. A reset that kept the openings would show a school twelve sessions
    // and zero answers and call it a collection problem, when what happened is
    // that a manager erased the collection.
    await surveyAttemptRepo.deleteByRoundId(roundId);

    // A persisted analysis describes responses that no longer exist.
    await aiInsightsRepo.deleteByRoundId(roundId);
    // Pending and terminal runs describe the same deleted response snapshot.
    // Removing them also releases the stable `automatic` request key so a new
    // collection cycle can enqueue once it reaches the threshold again.
    await aiAnalysisRunRepo.deleteByRoundId(roundId);
    // Goals normally outlive an analysis — that is the point of copying the
    // recommendation text into them. Reset is the exception: it does not re-run
    // the analysis, it declares that this round measured nothing, and a goal
    // chosen from an erased measurement has nothing left to track.
    const deletedGoalCount = await roundGoalRepo.deleteByRoundId(roundId);

    // The questionnaire's version history is deliberately left alone. Reset
    // erases what was measured, not what was written, and it hands the round
    // back for re-editing — which is exactly when an earlier questionnaire is
    // worth being able to return to.

    // Re-set round status to draft to allow question re-editing. Conditional on
    // the status this request read, like every other status write: a reset that
    // raced a manager archiving the same round would otherwise pull it back out
    // of `archived`, a transition nothing allows.
    const write = await roundRepo.updateStatus(
      roundId,
      "draft",
      authorization.round.status,
    );

    // Recorded either way, because the erasure above is what this event is
    // about and it has already happened. The status write is the last step and
    // the only one that can still miss.
    await recordRoundAuditEvent(
      auditLogRepo,
      request,
      "ROUND_RESET",
      roundId,
      authorization.round.organizationId,
      { deletedResponseCount, deletedGoalCount },
    );

    if (write.outcome !== "written") {
      const refusal = describeRefusedStatusWrite(write);
      if (write.outcome === "write_failed") {
        console.error("Returning a reset round to draft failed:", write.reason);
      }

      // The counts travel with the refusal. The responses really are gone, and
      // a manager told only that something conflicted would reasonably retry a
      // deletion that already succeeded.
      return NextResponse.json(
        {
          error: `The round's responses were erased, but the round could not be returned to draft. ${refusal.error}`,
          deletedResponseCount,
          deletedGoalCount,
        },
        { status: refusal.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Round data reset successfully.",
      round: write.round,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to reset round responses." },
      { status: 500 },
    );
  }
}
