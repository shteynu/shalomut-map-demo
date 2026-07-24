import { IRoundRepository } from '../repositories/interfaces';
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
    const roundId = crypto.randomUUID();
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
   * Create and persist a new round in the given repository
   */
  public static async createAndSaveRound(
    input: CreateRoundInput,
    roundRepo: IRoundRepository
  ): Promise<SurveyRound> {
    const round = this.createRound(input);
    return roundRepo.create(round);
  }

  /**
   * Find an active survey round by its share code
   */
  public static async getRoundByShareCode(
    shareCode: string,
    roundRepo: IRoundRepository
  ): Promise<SurveyRound | null> {
    return roundRepo.findByShareCode(shareCode);
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

