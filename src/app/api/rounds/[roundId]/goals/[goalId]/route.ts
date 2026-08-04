import { NextResponse } from "next/server";
import { resolveCoreRepositories } from "@/lib/composition-root";
import { getDurableWriteGuardResponse } from "@/lib/server/durable-write-guard";
import { authorizeManagerRound } from "@/lib/server/manager-scope";
import {
  badGoalRequest,
  toRoundGoalResponse,
} from "@/lib/server/round-goals";
import { RoundGoalService } from "@/lib/services/round-goal.service";

interface RouteParams {
  params: Promise<{ roundId: string; goalId: string }>;
}

const goalNotFound = (roundId: string, goalId: string) =>
  NextResponse.json(
    { error: "Goal not found for this round.", roundId, goalId },
    { status: 404 },
  );

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId, goalId } = await params;
    const { orgRepo, roundGoalRepo, roundRepo } = resolveCoreRepositories();

    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const parsed = RoundGoalService.parseStatus(await request.json());
    if (!parsed.ok) return badGoalRequest(parsed.error);

    const updated = await RoundGoalService.setStatus(
      roundId,
      goalId,
      parsed.status,
      roundGoalRepo,
    );
    if (!updated) return goalNotFound(roundId, goalId);

    return NextResponse.json({ goal: toRoundGoalResponse(updated) });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to update round goal: ${error.message}` },
      { status: 500 },
    );
  }
}

/**
 * Dropping a goal removes the row. A school that changed its mind is not
 * reporting an outcome, so there is no fourth status for it — and the same
 * recommendation can then be chosen again, which the unique key would otherwise
 * refuse forever.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId, goalId } = await params;
    const { orgRepo, roundGoalRepo, roundRepo } = resolveCoreRepositories();

    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const removed = await RoundGoalService.removeGoal(
      roundId,
      goalId,
      roundGoalRepo,
    );
    if (!removed) return goalNotFound(roundId, goalId);

    return NextResponse.json({ deleted: true, roundId, goalId });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to delete round goal: ${error.message}` },
      { status: 500 },
    );
  }
}
