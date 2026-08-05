import { NextResponse } from "next/server";
import type { SurveyRound } from "@/lib/types/backend";

/**
 * An archived round is a filed measurement, and this is what makes that true.
 *
 * `RoundService.isTransitionAllowed` already calls `archived` terminal. It was
 * only half true: reset writes the status directly rather than through that
 * table, so resetting an archived round quietly returned it to `draft` — a way
 * out of a state that has none. Re-running the analysis had no status check at
 * all and would rewrite the narrative of a round the school had already filed.
 *
 * What this deliberately does **not** guard is the goals a round produced.
 * Those are the school's own work rather than part of the measurement, and a
 * goal chosen last spring can still be finished this autumn (owner decision
 * 2026-08-05, `PROJECT_CONTEXT.md` ADR-018).
 *
 * `409`, not `403`: the request is authorized and well formed, and what refuses
 * it is the state of the round.
 */
export function getArchivedRoundGuardResponse(
  round: Pick<SurveyRound, "status">,
) {
  if (round.status !== "archived") return null;

  return NextResponse.json(
    {
      error:
        "This round is archived. An archived round is read-only: its responses, questionnaire and analysis cannot be changed.",
      code: "round_archived",
    },
    { status: 409 },
  );
}
