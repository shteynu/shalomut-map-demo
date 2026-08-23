import { NextResponse } from "next/server";
import {
  resolveCoreRepositories,
  runInTransaction,
} from "@/lib/composition-root";
import { getArchivedRoundGuardResponse } from "@/lib/server/archived-round-guard";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { authorizeManagerRound } from "@/lib/server/manager-scope";
import { recordRoundAuditEvent } from "@/lib/server/manager-audit";
import { refusedStatusWriteResponse } from "@/lib/server/round-status-write";
import { RoundResetService, type RoundErasure } from "@/lib/services";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const { auditLogRepo, orgRepo, roundRepo, surveyRepo } =
      resolveCoreRepositories();

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

    /*
     * The round stops collecting before anything is erased, and this is the
     * order rather than an implementation detail.
     *
     * It used to be the other way round: five deletes, then `draft` last, so
     * the round advertised itself as active for the whole duration of its own
     * erasure and a respondent submitting in that window wrote answers into a
     * round that had just declared it measured nothing. Writing the status
     * first and letting it commit means the share code is refused
     * (`ROUND_NOT_ACTIVE`) before the first delete runs.
     *
     * Conditional on the status this request read, like every other status
     * write. And refused cleanly: nothing has been erased yet, so there is no
     * half-done reset to explain — which is exactly why this step is first.
     */
    const write = await roundRepo.updateStatus(
      roundId,
      "draft",
      authorization.round.status,
    );
    if (write.outcome !== "written") return refusedStatusWriteResponse(write);

    /*
     * Five deletes across five repositories, and either all of them land or
     * none does. Before the transaction a crash in the middle left a round
     * whose saved analysis described responses that no longer existed — an
     * inconsistency nothing downstream could detect, because each half was
     * internally valid.
     */
    let erasure: RoundErasure | null = null;
    try {
      erasure = await runInTransaction((repositories) =>
        RoundResetService.eraseCollectedData(repositories, roundId),
      );

      /*
       * One sweep, for the submission that was already past its status check
       * when the round left `active`.
       *
       * That request read `active` a few milliseconds ago and is still on its
       * way to an insert; the status write above cannot reach it, and the
       * transaction cannot either — under `READ COMMITTED` a row inserted and
       * committed beside our transaction is simply not there to delete. So the
       * count is read again once the erasure has committed, and a straggler is
       * erased by running the same idempotent work a second time. It cannot be
       * followed by a third: the round has been `draft` for the whole duration
       * of the first transaction, so nothing new can have passed the check.
       *
       * What this is not: a lock. Closing the window completely means the
       * respondent's write taking a share lock on the round row and this one
       * taking it exclusively, which puts a transaction on the product's only
       * unauthenticated write in order to serialise it against an action a
       * manager takes by hand. That trade is not worth making here, and saying
       * so is better than implying the window is gone.
       */
      if ((await surveyRepo.getResponseCount(roundId)) > 0) {
        const swept = await runInTransaction((repositories) =>
          RoundResetService.eraseCollectedData(repositories, roundId),
        );
        erasure = {
          deletedResponseCount:
            erasure.deletedResponseCount + swept.deletedResponseCount,
          deletedGoalCount: erasure.deletedGoalCount + swept.deletedGoalCount,
        };
      }
    } catch (error) {
      /*
       * Caught here rather than by the handler's outer catch, which also covers
       * the steps before the status write, where either sentence below would be
       * a lie. Which one is true depends on whether the first transaction
       * committed, and that is the difference between "nothing happened" and
       * "almost everything did" — a manager deciding whether to retry needs it.
       *
       * A retry is free either way: every step is a delete by round id, and the
       * round is already out of `active`. That is the failure this ordering was
       * chosen for.
       */
      console.error(
        "Erasing a round's collected data failed:",
        error instanceof Error ? error.message : "unknown error",
      );

      return NextResponse.json(
        {
          error: erasure
            ? "The round was returned to draft and its responses were erased, but the final check did not finish. Run the reset once more."
            : "The round was returned to draft and is no longer collecting, but erasing its responses failed. Nothing was deleted — try again.",
        },
        { status: 500 },
      );
    }

    await recordRoundAuditEvent(
      auditLogRepo,
      request,
      "ROUND_RESET",
      roundId,
      authorization.round.organizationId,
      { ...erasure },
    );

    // Re-read rather than answering with the round the status write returned:
    // that row was fetched before the erasure and still carries the published
    // analytics this request has since cleared.
    const round = await roundRepo.findById(roundId);

    return NextResponse.json({
      success: true,
      message: "Round data reset successfully.",
      round: round ?? write.round,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to reset round responses." },
      { status: 500 },
    );
  }
}
