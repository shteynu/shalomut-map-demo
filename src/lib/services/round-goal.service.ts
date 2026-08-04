import { AI_ANALYTICS_DIMENSION_IDS } from '../ai-contract';
import type { IRoundGoalRepository } from '../repositories/interfaces';
import type { WellbeingDimensionId } from '../shalomut-source';
import {
  isRoundGoalStatus,
  type CreateRoundGoalInput,
  type CreateRoundGoalResult,
  type RoundGoal,
  type RoundGoalStatus,
} from '../types/round-goal';

/**
 * Long enough for the recommendations the provider actually writes, short
 * enough that the column is not an open text sink. A request over the limit is
 * refused rather than silently truncated: a goal that says something other than
 * what the manager chose is worse than a rejected request.
 */
export const ROUND_GOAL_TITLE_MAX_LENGTH = 200;
export const ROUND_GOAL_BODY_MAX_LENGTH = 2000;

export type RoundGoalInputError =
  | 'dimension_unknown'
  | 'title_required'
  | 'title_too_long'
  | 'body_required'
  | 'body_too_long'
  | 'status_unknown';

export type ParsedGoalInput =
  | { ok: true; input: CreateRoundGoalInput }
  | { ok: false; error: RoundGoalInputError };

function isKnownDimension(value: unknown): value is WellbeingDimensionId {
  return (
    typeof value === 'string' &&
    AI_ANALYTICS_DIMENSION_IDS.includes(value as WellbeingDimensionId)
  );
}

/**
 * A goal is created from whatever the client says the recommendation read.
 *
 * The text is not checked against the current analysis on purpose: the analysis
 * can be re-run between the screen rendering and the button being pressed, and
 * refusing the goal then would punish the manager for the provider's timing.
 * What is checked is that it names one of the eight dimensions and is text a
 * person could have read on screen.
 */
export class RoundGoalService {
  public static parseCreateInput(payload: unknown): ParsedGoalInput {
    const body = (payload ?? {}) as Record<string, unknown>;

    if (!isKnownDimension(body.dimensionId)) {
      return { ok: false, error: 'dimension_unknown' };
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return { ok: false, error: 'title_required' };
    if (title.length > ROUND_GOAL_TITLE_MAX_LENGTH) {
      return { ok: false, error: 'title_too_long' };
    }

    const goalBody = typeof body.body === 'string' ? body.body.trim() : '';
    if (!goalBody) return { ok: false, error: 'body_required' };
    if (goalBody.length > ROUND_GOAL_BODY_MAX_LENGTH) {
      return { ok: false, error: 'body_too_long' };
    }

    return {
      ok: true,
      input: { dimensionId: body.dimensionId, title, body: goalBody },
    };
  }

  public static parseStatus(
    payload: unknown,
  ): { ok: true; status: RoundGoalStatus } | { ok: false; error: RoundGoalInputError } {
    const status = (payload as Record<string, unknown> | null)?.status;
    return isRoundGoalStatus(status)
      ? { ok: true, status }
      : { ok: false, error: 'status_unknown' };
  }

  public static async listGoals(
    roundId: string,
    goalRepo: IRoundGoalRepository,
  ): Promise<RoundGoal[]> {
    return goalRepo.findByRoundId(roundId);
  }

  public static async createGoal(
    roundId: string,
    input: CreateRoundGoalInput,
    goalRepo: IRoundGoalRepository,
  ): Promise<CreateRoundGoalResult> {
    return goalRepo.create(roundId, input);
  }

  public static async setStatus(
    roundId: string,
    goalId: string,
    status: RoundGoalStatus,
    goalRepo: IRoundGoalRepository,
  ): Promise<RoundGoal | null> {
    return goalRepo.updateStatus(roundId, goalId, status);
  }

  public static async removeGoal(
    roundId: string,
    goalId: string,
    goalRepo: IRoundGoalRepository,
  ): Promise<boolean> {
    return goalRepo.delete(roundId, goalId);
  }
}
