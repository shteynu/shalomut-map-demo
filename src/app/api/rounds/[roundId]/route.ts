import { NextResponse } from "next/server";
import { getRepositories } from "@/lib/repositories";
import { RoundService } from "@/lib/services";
import type { RoundStatus } from "@/lib/types/backend";

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
    const { roundId } = await params;
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

    const { roundRepo } = getRepositories();
    const round = await roundRepo.findById(roundId);
    if (!round) {
      return NextResponse.json({ error: "Survey round not found." }, { status: 404 });
    }

    const targetStatus = body.status as RoundStatus;
    if (!RoundService.isTransitionAllowed(round.status, targetStatus)) {
      return NextResponse.json(
        {
          error: `Transition from '${round.status}' to '${targetStatus}' is not allowed.`,
        },
        { status: 409 },
      );
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
