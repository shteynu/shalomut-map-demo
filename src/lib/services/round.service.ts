import {
  CreateRoundInput,
  RoundStatus,
  SurveyRound,
} from '../types/backend';

export class RoundService {
  /**
   * Generate human-readable share code for survey distribution
   */
  public static generateShareCode(): string {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SHALOM-${randomSuffix}`;
  }

  /**
   * Initialize a new survey round configuration
   */
  public static createRound(input: CreateRoundInput): SurveyRound {
    const roundId = `round_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: roundId,
      organizationId: input.organizationId,
      title: input.title,
      status: 'active',
      shareCode: this.generateShareCode(),
      privacyThreshold: input.privacyThreshold ?? 10,
      startDate: input.startDate ?? new Date(),
      createdAt: new Date(),
    };
  }

  /**
   * Validate status transition logic
   */
  public static isTransitionAllowed(
    current: RoundStatus,
    target: RoundStatus
  ): boolean {
    const transitions: Record<RoundStatus, RoundStatus[]> = {
      draft: ['active', 'archived'],
      active: ['closed', 'archived'],
      closed: ['active', 'archived'],
      archived: [],
    };

    return transitions[current]?.includes(target) ?? false;
  }
}
