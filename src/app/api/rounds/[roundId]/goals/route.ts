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
  params: Promise<{ roundId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const { orgRepo, roundGoalRepo, roundRepo } = resolveCoreRepositories();

    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const goals = await RoundGoalService.listGoals(roundId, roundGoalRepo);
    return NextResponse.json({ roundId, goals: goals.map(toRoundGoalResponse) });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to read round goals: ${error.message}` },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const { orgRepo, roundGoalRepo, roundRepo } = resolveCoreRepositories();

    const authorization = await authorizeManagerRound(
      request,
      roundId,
      orgRepo,
      roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const parsed = RoundGoalService.parseCreateInput(await request.json());
    if (!parsed.ok) return badGoalRequest(parsed.error);

    const result = await RoundGoalService.createGoal(
      roundId,
      parsed.input,
      roundGoalRepo,
    );

    // A double-tapped button reaches here twice. The second attempt is answered
    // with the goal that already exists rather than a bare failure, so the
    // screen can reconcile instead of guessing what happened.
    if (result.outcome === "duplicate") {
      return NextResponse.json(
        {
          error: "This recommendation is already tracked as a goal.",
          code: "goal_already_exists",
          goal: toRoundGoalResponse(result.goal),
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { goal: toRoundGoalResponse(result.goal) },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to create round goal: ${error.message}` },
      { status: 500 },
    );
  }
}
