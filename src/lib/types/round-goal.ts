import type { WellbeingDimensionId } from '../shalomut-source';

/**
 * A recommendation the school decided to work on.
 *
 * The three states are deliberately the smallest set that still makes the word
 * "tracked" true: a goal is chosen, then worked on, then finished. There is no
 * owner, no due date and no plan of steps — dropping a goal is deleting it, not
 * a fourth state, because a school that changed its mind is not reporting an
 * outcome.
 */
export const ROUND_GOAL_STATUSES = ['selected', 'in_progress', 'done'] as const;

export type RoundGoalStatus = (typeof ROUND_GOAL_STATUSES)[number];

export function isRoundGoalStatus(value: unknown): value is RoundGoalStatus {
  return (
    typeof value === 'string' &&
    (ROUND_GOAL_STATUSES as readonly string[]).includes(value)
  );
}

export interface RoundGoal {
  id: string;
  roundId: string;
  dimensionId: WellbeingDimensionId;
  /**
   * The recommendation's text as it read when the manager chose it, copied
   * rather than referenced. The next analysis run rewrites its recommendations
   * wholesale; a goal that followed them would lose the decision it records.
   */
  title: string;
  body: string;
  status: RoundGoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoundGoalInput {
  dimensionId: WellbeingDimensionId;
  title: string;
  body: string;
}

/**
 * A second attempt at the same recommendation is not an error the manager
 * caused — a double tap reaches the endpoint twice — so the existing goal comes
 * back with the outcome instead of only a failure.
 */
export type CreateRoundGoalResult =
  | { outcome: 'created'; goal: RoundGoal }
  | { outcome: 'duplicate'; goal: RoundGoal };
