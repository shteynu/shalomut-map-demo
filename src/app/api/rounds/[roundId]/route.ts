import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { RoundService } from "@/lib/services";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { recordRoundAuditEvent } from "@/lib/server/manager-audit";
import { authorizeManagerRound } from "@/lib/server/manager-scope";
import { refusedStatusWriteResponse } from "@/lib/server/round-status-write";
import { enqueueAiAnalyticsOnClosure } from "@/lib/server/trigger-ai-analytics";
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
    const { aiAnalysisRunRepo, auditLogRepo, orgRepo, roundRepo, surveyRepo } =
      resolveCoreRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
      auditLogRepo,
      "write:update-round-status",
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

    /*
     * The status the transition was validated against travels into the write,
     * so the database applies it only if the round is still there. Two managers
     * who both read `active` therefore produce one close and one 409, rather
     * than one close and one write landing on top of a round that had already
     * moved — including onto an `archived` one, which no transition allows.
     */
    const write = await roundRepo.updateStatus(
      roundId,
      targetStatus,
      round.status,
    );

    /*
     * Everything below is a consequence of the write, so nothing below runs
     * unless the write happened. Until 2026-08-22 the audit event and the
     * analysis dispatch ran unconditionally: a refused activation was recorded
     * as a transition that never occurred, and a failed `active → closed` still
     * queued the closing analysis — producing a map for a round that was still
     * collecting, which is exactly what the 2026-08-17 decision removed.
     */
    if (write.outcome !== "written") {
      return refusedStatusWriteResponse(write);
    }

    const updated = write.round;

    await recordRoundAuditEvent(
      auditLogRepo,
      request,
      "ROUND_STATUS_UPDATED",
      roundId,
      round.organizationId,
      { from: round.status, to: targetStatus },
    );

    /*
     * Closing a round is what asks for its analysis (owner decision
     * 2026-08-17). It happens after the status write rather than inside it, so
     * that a round which the manager meant to close is closed even when the
     * dispatch cannot be recorded — collection has ended either way, and the
     * re-analysis button is the way back. The reverse order would leave a round
     * open because a queue row failed.
     *
     * Below the threshold this queues nothing and says so; that is a normal
     * outcome for a round that ended short, not a failure to report.
     */
    if (targetStatus === "closed") {
      try {
        const outcome = await enqueueAiAnalyticsOnClosure(
          roundId,
          round.privacyThreshold,
          aiAnalysisRunRepo,
          surveyRepo,
        );
        return NextResponse.json({
          success: true,
          round: updated,
          analysis: outcome,
        });
      } catch (error) {
        console.error(
          "Dispatching the analysis for a closed round failed:",
          error instanceof Error ? error.message : "unknown error",
        );
        return NextResponse.json({
          success: true,
          round: updated,
          analysis: "not_dispatched",
        });
      }
    }

    return NextResponse.json({ success: true, round: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update survey round." },
      { status: 500 },
    );
  }
}
