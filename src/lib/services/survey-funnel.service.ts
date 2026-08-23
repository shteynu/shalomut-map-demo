import type { ISurveyAttemptRepository } from '../repositories/interfaces';
import {
  RoundResponseFunnel,
  SURVEY_ATTEMPT_CLIENT_STAGES,
  SurveyAttemptClientStage,
  SurveyAttemptRecord,
} from '../types/backend';

/**
 * Below this many abandoned sessions the product does not say where they
 * stopped.
 *
 * The count itself is aggregate and harmless, but "the one person who gave up
 * stopped on question 4 — the one about management support" is a sentence about
 * an individual in a staff room of twenty, and this product's whole proposition
 * is that it never produces one. It is a smaller floor than the privacy
 * threshold because it guards a weaker signal, and it is a floor rather than
 * nothing because the signal is real.
 */
export const ABANDON_DETAIL_MINIMUM = 3;

export class SurveyFunnelService {
  /** Whether a value is a stage a respondent's client is allowed to claim. */
  public static isClientStage(value: unknown): value is SurveyAttemptClientStage {
    return (
      typeof value === 'string' &&
      (SURVEY_ATTEMPT_CLIENT_STAGES as readonly string[]).includes(value)
    );
  }

  /**
   * Whether a value can be stored as a question index.
   *
   * The endpoint is public, so this refuses rather than coerces: a negative or
   * fractional index would survive `Math.max` and quietly corrupt the median.
   */
  public static isQuestionIndex(value: unknown): value is number {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < 1000
    );
  }

  public static async record(
    input: {
      roundId: string;
      anonymousTokenHash: string;
      stage: SurveyAttemptClientStage;
      lastQuestionReached?: number;
      at?: Date;
    },
    attemptRepo: ISurveyAttemptRepository,
  ): Promise<SurveyAttemptRecord> {
    return attemptRepo.record(input);
  }

  /**
   * What happened to the people who received the link.
   *
   * `completed` is counted from responses rather than from attempts, because a
   * response is the durable fact and a completion beacon is not: the submit
   * route marks the attempt, but a round that collected answers before this
   * table existed has responses with no session behind them. Reporting the
   * attempt count as completions there would show a school fewer submissions
   * than it has.
   *
   * Takes what it counts rather than the repositories to count it from. The
   * only screen that renders this funnel renders the fill-time report beside
   * it, and both were reading the round's attempts — the same query, twice, on
   * one render. Reads belong to the entrypoint (ADR-008), and this became a
   * function of its inputs on the way.
   */
  public static getRoundFunnel(
    attempts: readonly SurveyAttemptRecord[],
    completed: number,
  ): RoundResponseFunnel {
    const consentedAttempts = attempts.filter(
      (attempt) => attempt.consentAcceptedAt,
    );
    const completedAttempts = attempts.filter((attempt) => attempt.completedAt);
    const abandonedAttempts = consentedAttempts.filter(
      (attempt) => !attempt.completedAt,
    );

    const abandonedIndices = abandonedAttempts
      .map((attempt) => attempt.lastQuestionReached)
      .filter((index): index is number => index !== undefined)
      .sort((left, right) => left - right);

    return {
      opened: attempts.length,
      consented: consentedAttempts.length,
      completed,
      abandoned: abandonedAttempts.length,
      medianAbandonedAtQuestion:
        abandonedIndices.length >= ABANDON_DETAIL_MINIMUM
          ? abandonedIndices[Math.floor((abandonedIndices.length - 1) / 2)]
          : undefined,
      completedWithoutAttempt: Math.max(0, completed - completedAttempts.length),
      lastOpenedAt: latest(attempts.map((attempt) => attempt.openedAt)),
      lastCompletedAt: latest(
        completedAttempts.map((attempt) => attempt.completedAt),
      ),
    };
  }
}

function latest(dates: (Date | undefined)[]): Date | undefined {
  const known = dates.filter((date): date is Date => Boolean(date));
  if (known.length === 0) return undefined;

  return known.reduce((newest, date) => (date > newest ? date : newest));
}
