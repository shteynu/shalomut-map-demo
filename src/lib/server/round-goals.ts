import { NextResponse } from "next/server";
import {
  ROUND_GOAL_BODY_MAX_LENGTH,
  ROUND_GOAL_TITLE_MAX_LENGTH,
  type RoundGoalInputError,
} from "@/lib/services/round-goal.service";
import { ROUND_GOAL_STATUSES, type RoundGoal } from "@/lib/types/round-goal";

/**
 * The wire shape of a goal. Dates cross as ISO strings, and nothing else is
 * added: a goal names a dimension and repeats manager-facing copy that already
 * cleared the privacy gate before it could appear on screen.
 */
export interface RoundGoalResponse {
  id: string;
  roundId: string;
  dimensionId: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function toRoundGoalResponse(goal: RoundGoal): RoundGoalResponse {
  return {
    id: goal.id,
    roundId: goal.roundId,
    dimensionId: goal.dimensionId,
    title: goal.title,
    body: goal.body,
    status: goal.status,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

const INPUT_ERROR_MESSAGES: Record<RoundGoalInputError, string> = {
  dimension_unknown: "A goal must name one of the eight wellbeing dimensions.",
  title_required: "A goal requires a title.",
  title_too_long: `A goal title is limited to ${ROUND_GOAL_TITLE_MAX_LENGTH} characters.`,
  body_required: "A goal requires a body.",
  body_too_long: `A goal body is limited to ${ROUND_GOAL_BODY_MAX_LENGTH} characters.`,
  status_unknown: `A goal status must be one of ${ROUND_GOAL_STATUSES.join(", ")}.`,
};

/** A typed `code` travels with the prose, the way the submit endpoint answers. */
export function badGoalRequest(error: RoundGoalInputError) {
  return NextResponse.json(
    { error: INPUT_ERROR_MESSAGES[error], code: error },
    { status: 400 },
  );
}
