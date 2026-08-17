import {
  summariseFillingDurations,
  type FillingDurationSummary,
} from '../analytics/filling-duration';
import type {
  ISurveyAttemptRepository,
  ISurveyRepository,
} from '../repositories/interfaces';
import { effectivePrivacyThreshold } from '../survey-definition';
import { estimateMinutesForQuestionnaire } from '../survey/survey-duration';
import type { SurveyRound } from '../types/backend';

const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Why a stored response has no filling duration behind it.
 *
 * Counted separately and named rather than folded into one "unknown", on the
 * precedent of `completedWithoutAttempt` in `RoundResponseFunnel`: a report
 * that quietly dropped these would show a school a fast-filling rate computed
 * over a denominator it never stated. **A response without timing is not a fast
 * one**, and this is the type that makes saying so unavoidable.
 *
 * These three are published as raw counts with no floor, unlike the fast count.
 * They describe the coverage of the instrument, not a person: "one response
 * arrived without a session behind it" says nothing about who wrote it, what
 * they answered, or how long they took. `completedWithoutAttempt` is published
 * the same way for the same reason.
 */
export interface UnmeasuredFillings {
  /**
   * The response carries no session token. It is optional on the response, and
   * a submission without one has no session to join to.
   */
  readonly withoutToken: number;
  /**
   * The token is there and no attempt row matches it — a round that collected
   * answers before `survey_attempts` existed, or a session whose opening beacon
   * never arrived. The beacon is fired without waiting for a reply and is
   * swallowed on error by design, so losing one is expected rather than odd.
   */
  readonly withoutAttempt: number;
  /**
   * Both rows exist and the arithmetic between them is not a duration — the
   * session appears to have ended before it began.
   *
   * No known path produces this: both timestamps come from the database's own
   * clock and the attempt row is always written first. It is counted rather
   * than silently skipped because the two timestamps are written by different
   * requests against different tables, and if that assumption ever stops
   * holding, a bucket that shows it is worth more than a median that quietly
   * absorbs it.
   */
  readonly unusable: number;
}

export interface RoundFillingSummary {
  /**
   * Minutes the questionnaire asks for, computed from the questions it actually
   * asks rather than read from the stored `estimatedMinutes` field.
   *
   * This is the number the respondent was shown: `survey-flow.tsx` computes it
   * the same way at render time, and deliberately, so that a definition whose
   * questions were trimmed after the estimate was written cannot promise the
   * wrong minutes. Measuring against the stored field would compare a round to
   * an estimate nobody in it ever read.
   */
  readonly estimatedMinutes: number;
  /** Responses the round holds. */
  readonly responses: number;
  /** How the responses without a duration break down. */
  readonly unmeasured: UnmeasuredFillings;
  /** What may be published about the ones with a duration. */
  readonly durations: FillingDurationSummary;
  /**
   * How many of the measured responses were measured precisely — the
   * respondent's browser counting the time the questionnaire was on screen,
   * rather than the round's own clock counting the whole session.
   *
   * Published because the two are different quantities and the median mixes
   * them. The fast count does not need the caveat: a session's lifetime is
   * always at least its visible time, so a response short enough to be flagged
   * on the lifetime is short on either measure, and the count therefore never
   * over-reports. The median has no such argument, which is why this number
   * sits beside it.
   */
  readonly measuredPrecisely: number;
}

export type RoundFillingReport =
  /**
   * The round stored no questionnaire, so there is no estimate to measure
   * against. An explicit state rather than the canonical fallback: falling back
   * would measure a round against an instrument it did not run, and report the
   * difference as respondent behaviour.
   */
  | { readonly status: 'no-questionnaire' }
  /**
   * Fewer responses than the round's privacy threshold. The same gate as every
   * other detailed result the round produces — a report about how ten people
   * filled a questionnaire is a report about those ten people.
   */
  | {
      readonly status: 'below-privacy-threshold';
      readonly responses: number;
      readonly threshold: number;
    }
  | { readonly status: 'ready'; readonly summary: RoundFillingSummary };

/**
 * How a round was filled — descriptive only.
 *
 * This service answers "did this collection go the way the questionnaire
 * assumed", and it is not permitted to answer "which responses should be
 * dropped". `docs/response-quality-research-2026-08-17.md` §5.3 is why: dropping
 * anyone gives the round a second basis of calculation, and its published
 * per-question distributions then read the dropped person's answers directly.
 * Nothing here returns a response id, a token or an individual duration, and
 * that is the property to preserve rather than an omission to fill in.
 *
 * Shaped after `SurveyFunnelService`: static, repositories as parameters,
 * `resolveCoreRepositories` left to entrypoints.
 */
export class RoundFillingService {
  public static async getRoundFilling(
    round: Pick<SurveyRound, 'id' | 'privacyThreshold' | 'surveyDefinition'>,
    attemptRepo: ISurveyAttemptRepository,
    surveyRepo: ISurveyRepository,
  ): Promise<RoundFillingReport> {
    const definition = round.surveyDefinition;
    if (!definition) return { status: 'no-questionnaire' };

    const [responses, attempts] = await Promise.all([
      surveyRepo.findResponsesByRoundId(round.id),
      attemptRepo.findByRoundId(round.id),
    ]);

    const threshold = effectivePrivacyThreshold(round.privacyThreshold);
    if (responses.length < threshold) {
      return {
        status: 'below-privacy-threshold',
        responses: responses.length,
        threshold,
      };
    }

    const openedAt = new Map(
      attempts.map((attempt) => [attempt.anonymousTokenHash, attempt.openedAt]),
    );

    let withoutToken = 0;
    let withoutAttempt = 0;
    let unusable = 0;
    let measuredPrecisely = 0;
    const minutes: number[] = [];

    for (const response of responses) {
      /*
       * The respondent's own browser counted this: wall time while the
       * questionnaire was visible, summed over the attempt and sent once with
       * the answers. It needs no attempt row and no token, so it is read before
       * either is asked for — a response whose opening beacon was lost still
       * has a real duration when it carries this.
       */
      if (response.visibleSeconds !== undefined) {
        measuredPrecisely += 1;
        minutes.push(response.visibleSeconds / 60);
        continue;
      }

      if (!response.anonymousTokenHash) {
        withoutToken += 1;
        continue;
      }

      const opened = openedAt.get(response.anonymousTokenHash);
      if (!opened) {
        withoutAttempt += 1;
        continue;
      }

      /*
       * The session ends at the response, not at the attempt's `completedAt`.
       * The response is the durable fact and the attempt row is a beacon —
       * `SurveyFunnelService` counts completions from responses for exactly
       * this reason — so a submission whose `markCompleted` never landed still
       * has a timestamp here instead of becoming a fourth kind of missing.
       */
      const elapsed = response.submittedAt.getTime() - opened.getTime();

      if (!Number.isFinite(elapsed) || elapsed <= 0) {
        unusable += 1;
        continue;
      }

      minutes.push(elapsed / MILLISECONDS_PER_MINUTE);
    }

    const estimatedMinutes = estimateMinutesForQuestionnaire(
      definition.questions.filter((question) => question.enabled),
    );

    return {
      status: 'ready',
      summary: {
        estimatedMinutes,
        responses: responses.length,
        measuredPrecisely,
        unmeasured: { withoutToken, withoutAttempt, unusable },
        durations: summariseFillingDurations(minutes, estimatedMinutes),
      },
    };
  }
}
