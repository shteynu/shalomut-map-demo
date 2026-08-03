import { IRoundRepository } from '../repositories/interfaces';
import {
  CreateRoundInput,
  RoundStatus,
  SurveyRound,
} from '../types/backend';
import {
  DEFAULT_PRIVACY_THRESHOLD,
  createEmptyDraftSurveyDefinition,
  isActivatableSurveyDefinition,
  parseSurveyDefinition,
} from '../survey-definition';

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
    const privacyThreshold =
      input.privacyThreshold ??
      input.surveyDefinition?.minimumResponses ??
      DEFAULT_PRIVACY_THRESHOLD;
    const definitionCandidate = input.surveyDefinition
      ? {
          ...input.surveyDefinition,
          minimumResponses: privacyThreshold,
        }
      : createEmptyDraftSurveyDefinition(input.title, privacyThreshold);
    // A round may start from an empty questionnaire, so the structural parse is
    // permissive here. Activation stays gated on the full eight-dimension
    // coverage below.
    const parsedDefinition = parseSurveyDefinition(definitionCandidate, {
      allowIncomplete: true,
    });
    if (!parsedDefinition.ok) {
      throw new Error(`Survey round cannot be activated: ${parsedDefinition.error}`);
    }

    return {
      id: roundId,
      organizationId: input.organizationId,
      title: input.title,
      status: isActivatableSurveyDefinition(parsedDefinition.value)
        ? 'active'
        : 'draft',
      shareCode: this.generateShareCode(),
      privacyThreshold,
      startDate: input.startDate ?? new Date(),
      endDate: input.endDate,
      backgroundContext: input.backgroundContext,
      surveyDefinition: parsedDefinition.value,
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
    const created = await roundRepo.create(round);

    // A round created with a complete questionnaire is born active, which makes
    // it the school's running round the moment it exists.
    if (created.status === 'active') {
      await this.closeOtherActiveRounds(created, roundRepo);
    }

    return created;
  }

  /**
   * Make a draft round the school's running round.
   *
   * One school runs one round at a time (owner decision 2026-08-03), so
   * activating a round closes whichever round was active before it. Two active
   * rounds would mean two live share links and no answer to which round a
   * respondent is answering.
   */
  public static async activateRound(
    roundId: string,
    roundRepo: IRoundRepository,
  ): Promise<{ round: SurveyRound; closedRounds: SurveyRound[] } | null> {
    const activated = await roundRepo.updateStatus(roundId, 'active');
    if (!activated) return null;

    return {
      round: activated,
      closedRounds: await this.closeOtherActiveRounds(activated, roundRepo),
    };
  }

  /**
   * Close every other active round of the same school, and report which ones.
   *
   * These are separate writes rather than one transaction: the repository
   * interface has no transaction primitive, and a deployment has one manager,
   * so nothing else is activating rounds concurrently. The durable version of
   * this rule is a partial unique index on `(organization_id) where status =
   * 'active'`, which is not in the schema yet — until then the rule is upheld
   * here rather than by the database.
   */
  public static async closeOtherActiveRounds(
    round: SurveyRound,
    roundRepo: IRoundRepository,
  ): Promise<SurveyRound[]> {
    const siblings = await roundRepo.findByOrganizationId(round.organizationId);
    const closed: SurveyRound[] = [];

    for (const sibling of siblings) {
      if (sibling.id === round.id || sibling.status !== 'active') continue;

      const result = await roundRepo.updateStatus(sibling.id, 'closed');
      if (result) closed.push(result);
    }

    return closed;
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
