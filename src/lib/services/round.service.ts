import { IRoundRepository } from '../repositories/interfaces';
import { isRoundTransitionAllowed } from '../rounds/round-status';
import {
  CreateRoundInput,
  RoundStatus,
  SurveyRound,
} from '../types/backend';
import { resolveAudienceLabel } from '../audience';
import {
  DEFAULT_PRIVACY_THRESHOLD,
  createCanonicalSurveyDefinition,
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
    // A caller who did not bring a questionnaire gets the standard one, so a
    // new round opens with something to read instead of an empty builder. Until
    // 2026-08-09 it was seeded empty, and "a questionnaire is generated for the
    // new round" was not true of any creation path.
    const definitionCandidate = input.surveyDefinition
      ? {
          ...input.surveyDefinition,
          minimumResponses: privacyThreshold,
        }
      : {
          ...createCanonicalSurveyDefinition(input.title, privacyThreshold),
          // The audience belongs to the round, and the questionnaire shows it
          // to respondents. Taking it from here is what keeps the two screens
          // from disagreeing about who was asked.
          audience: resolveAudienceLabel(input.backgroundContext?.audience),
        };
    // A caller may still bring an unfinished questionnaire, so the structural
    // parse is permissive here. Activation stays gated on the full
    // eight-dimension coverage below.
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
      /*
       * Born active only when the caller brought the questionnaire it should
       * run. A seeded one is complete enough to activate, but nobody has read
       * it yet — and a round that is born active takes the school's collection
       * with it, closing the round still gathering answers. So the standard
       * questionnaire arrives as a draft, and saving it in the builder is what
       * puts it live.
       */
      status:
        input.surveyDefinition &&
        isActivatableSurveyDefinition(parsedDefinition.value)
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

    // A round created with a complete questionnaire is born active, which makes
    // it the school's running round the moment it exists — so the round it
    // replaces has to be closed first. The partial unique index refuses a
    // second active round, and this row does not exist yet to be excluded from
    // the closing sweep.
    if (round.status === 'active') {
      await this.closeOtherActiveRounds(round, roundRepo);
    }

    return roundRepo.create(round);
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
    const round = await roundRepo.findById(roundId);
    if (!round) return null;

    // The previous round is closed before this one goes live, not after: the
    // database now refuses two active rounds of one school, so the other order
    // would be rejected on the very write that makes this round live. It also
    // fails in the safer direction — if the activation write is lost, the
    // school is left with no running round rather than two.
    const closedRounds = await this.closeOtherActiveRounds(round, roundRepo);

    const activated = await roundRepo.updateStatus(roundId, 'active');
    if (!activated) return null;

    return { round: activated, closedRounds };
  }

  /**
   * Close every other active round of the same school, and report which ones.
   *
   * These are separate writes rather than one transaction: the repository
   * interface has no transaction primitive, and a deployment has one manager,
   * so nothing else is activating rounds concurrently. The rule itself is now
   * durable — the partial unique index `survey_rounds_one_active_per_organization`
   * refuses a second active round — and this method is what keeps the ordinary
   * path from running into it.
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
    return isRoundTransitionAllowed(current, target);
  }
}
