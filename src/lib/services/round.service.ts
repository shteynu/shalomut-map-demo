import {
  IRoundRepository,
  RoundStatusWrite,
} from '../repositories/interfaces';
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

/**
 * What `activateRound` did.
 *
 * The failure branch carries both the reason and the rounds the attempt had
 * already closed on its way there, because those two facts together are the
 * school's actual situation: no round is running, and here is which one
 * stopped. Answering `null` — as this did until 2026-08-22 — let the builder
 * report a save that went live when nothing had.
 */
export type RoundActivation =
  | { ok: true; round: SurveyRound; closedRounds: SurveyRound[] }
  | {
      ok: false;
      failure: Exclude<RoundStatusWrite, { outcome: 'written' }>;
      closedRounds: SurveyRound[];
    };

/**
 * Cryptographic bytes, in the one place that needs them. Separate from
 * `generateShareCode` only so the rejection rule can be tested without a
 * random source.
 */
function fillRandomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}

export class RoundService {
  /**
   * The share code is the only thing standing between a stranger and a school's
   * questionnaire, so it is guessing-resistant rather than merely unique.
   *
   * It used to be four characters of `Math.random().toString(36)` — about 1.7
   * million values from a generator with no cryptographic claim, and
   * `substring(2, 6)` could return fewer than four characters when the random
   * value was short. Anyone could walk the space.
   *
   * The alphabet omits `0/O` and `1/I/L`, because this code is read off a slide
   * in a staff meeting and typed by hand. That leaves 31 characters, and 31
   * does not divide 256 — the comment here claimed it did until 2026-08-22,
   * and the mapping below took `byte % 31`, so the first eight characters came
   * up about 12.5% more often than the other twenty-three.
   *
   * The practical cost was small: the space is still 31^10, and the bias buys
   * an attacker under a bit of it. The claim was the problem. "The only thing
   * standing between a stranger and a school's questionnaire" is a sentence
   * this file writes about itself, and a false uniformity claim underneath it
   * is what a future change would have been measured against.
   */
  private static readonly SHARE_CODE_ALPHABET =
    "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  private static readonly SHARE_CODE_LENGTH = 10;
  private static readonly SHARE_CODE_ATTEMPTS = 5;

  /**
   * The largest multiple of the alphabet length that fits in a byte: 31 × 8.
   * A byte at or above it is discarded rather than folded, which is what makes
   * every character equally likely instead of nearly so.
   */
  private static readonly SHARE_CODE_UNBIASED_CEILING =
    256 - (256 % 31);

  /** How many bytes to draw at a time. Rejection wastes about 3% of them. */
  private static readonly SHARE_CODE_DRAW = 16;

  /**
   * Generate human-readable share code for survey distribution.
   *
   * `randomBytes` is a seam for the test that proves a byte above the ceiling
   * is skipped rather than wrapped. Nothing in the application passes it.
   */
  public static generateShareCode(
    randomBytes: (count: number) => Uint8Array = fillRandomBytes,
  ): string {
    const alphabet = this.SHARE_CODE_ALPHABET;
    let suffix = "";

    while (suffix.length < this.SHARE_CODE_LENGTH) {
      for (const byte of randomBytes(this.SHARE_CODE_DRAW)) {
        if (byte >= this.SHARE_CODE_UNBIASED_CEILING) continue;
        suffix += alphabet[byte % alphabet.length];
        if (suffix.length === this.SHARE_CODE_LENGTH) break;
      }
    }

    return `SHALOM-${suffix}`;
  }

  /**
   * A share code that no round in the repository already holds.
   *
   * The old four-character code was generated once and written straight at a
   * unique index, so a collision surfaced as a failed round creation the
   * manager could do nothing about. Collisions are now vanishingly unlikely,
   * which is exactly why a bounded retry is cheap: it never runs.
   */
  private static async generateUnusedShareCode(
    roundRepo: IRoundRepository,
  ): Promise<string> {
    for (let attempt = 0; attempt < this.SHARE_CODE_ATTEMPTS; attempt += 1) {
      const candidate = this.generateShareCode();
      const taken = await roundRepo.findByShareCode(candidate);
      if (!taken) return candidate;
    }

    throw new Error(
      "Could not generate an unused survey share code; this indicates a broken random source rather than exhausted codes",
    );
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
   * Create and persist a new round in the given repository.
   *
   * Reports the rounds it closed for the same reason `activateRound` does: a
   * round born active supersedes whichever round the school was running, and
   * the caller is the one that can ask for that round's analysis. Answering
   * with the new round alone left that close invisible to everything above it.
   */
  public static async createAndSaveRound(
    input: CreateRoundInput,
    roundRepo: IRoundRepository
  ): Promise<{ round: SurveyRound; closedRounds: SurveyRound[] }> {
    // The code is replaced rather than generated inside `createRound`, which
    // stays synchronous: only the persisting path can ask the repository
    // whether a candidate is already taken.
    const round = {
      ...this.createRound(input),
      shareCode: await this.generateUnusedShareCode(roundRepo),
    };

    // A round created with a complete questionnaire is born active, which makes
    // it the school's running round the moment it exists — so the round it
    // replaces has to be closed first. The partial unique index refuses a
    // second active round, and this row does not exist yet to be excluded from
    // the closing sweep.
    const closedRounds =
      round.status === 'active'
        ? await this.closeOtherActiveRounds(round, roundRepo)
        : [];

    return { round: await roundRepo.create(round), closedRounds };
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
  ): Promise<RoundActivation> {
    const round = await roundRepo.findById(roundId);
    if (!round) {
      return { ok: false, failure: { outcome: 'not_found' }, closedRounds: [] };
    }

    // The previous round is closed before this one goes live, not after: the
    // database now refuses two active rounds of one school, so the other order
    // would be rejected on the very write that makes this round live. It also
    // fails in the safer direction — if the activation write is lost, the
    // school is left with no running round rather than two.
    const closedRounds = await this.closeOtherActiveRounds(round, roundRepo);

    const activated = await roundRepo.updateStatus(roundId, 'active', round.status);
    if (activated.outcome !== 'written') {
      // The rounds this attempt already closed travel with the failure. They
      // are the part the school will notice — it has no running round now —
      // and a caller that could not name them would have to report the loss as
      // nothing having happened.
      return { ok: false, failure: activated, closedRounds };
    }

    return { ok: true, round: activated.round, closedRounds };
  }

  /**
   * Close every other active round of the same school, and report which ones.
   *
   * These are separate writes rather than one transaction: the repository
   * interface has no transaction primitive. The rule itself is durable — the
   * partial unique index `survey_rounds_one_active_per_organization` refuses a
   * second active round — and this method is what keeps the ordinary path from
   * running into it.
   *
   * A sibling that could not be closed is left out of the returned list and is
   * deliberately not raised here. It still holds the school's one active slot,
   * so the activation that follows meets the index and comes back as
   * `another_round_is_active` — one report, from the write that actually
   * failed, instead of two descriptions of the same jam.
   */
  public static async closeOtherActiveRounds(
    round: SurveyRound,
    roundRepo: IRoundRepository,
  ): Promise<SurveyRound[]> {
    const siblings = await roundRepo.findByOrganizationId(round.organizationId);
    const closed: SurveyRound[] = [];

    for (const sibling of siblings) {
      if (sibling.id === round.id || sibling.status !== 'active') continue;

      const result = await roundRepo.updateStatus(sibling.id, 'closed', 'active');
      if (result.outcome === 'written') closed.push(result.round);
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
