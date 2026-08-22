import { readAnalyticAnswers } from '../analytics/analytic-answers';
import {
  LEGACY_ANALYTICS_CONTRACT_VERSION,
  PRODUCER_CONTRACT_VERSION_ENV,
  UnsupportedProducerContractVersionError,
  getProducedAnalyticsContractVersion,
  resolveProducedAnalyticsContractVersion,
} from '../ai-contract-version';
import { IRoundRepository, ISurveyRepository } from '../repositories/interfaces';
import { isRoundCollecting } from '../rounds/round-status';
import { statusForScore } from '../scoring-bands';
import { AnswerScaleId, COLOUR_SCALE_ID } from '../survey/answer-scales';
import {
  WellbeingDimensionId,
  WellbeingStatus,
  responseScale,
  surveyInstrument,
} from '../shalomut-source';
import {
  createCanonicalSurveyDefinition,
  effectivePrivacyThreshold,
  isActivatableSurveyDefinition,
  parseSurveyDefinition,
} from '../survey-definition';
import {
  createMeasurementSnapshotHash,
  createSurveyDefinitionHash,
} from '../survey-definition-hash';
import {
  QuestionAggregate,
  QuestionAnswerRecord,
  RoundAnalyticsResult,
  RoundDimensionScore,
  SurveyResponseRecord,
  SurveyRound,
  isAnalyticQuestion,
} from '../types/backend';
import {
  CanonicalQuestionAggregate,
  CanonicalRoundAnalytics,
} from '../types/canonical-analytics';

/**
 * Which analytics contract this deployment produces.
 *
 * `4.0` differs from `3.0` only by carrying the school background context into
 * the AI prompt, and the Python consumer must already accept it before Core
 * starts emitting it. Keeping the switch in configuration makes that
 * consumer-first rollout a config change on a verified Python deployment
 * instead of a code deploy racing the other service.
 *
 * Resolution and validation live in `../ai-contract-version`, which reports an
 * unsupported value instead of throwing, so `/api/health` can name the problem.
 */
export { getProducedAnalyticsContractVersion };

// Checked once, when this module is first imported, rather than on the first
// round that needs it. `next build` pulls in the routes that import this file,
// so a deployment configured with a version Core cannot produce fails while it
// is being built — which is the point of fail-closed. An unset variable is a
// documented default and passes here.
{
  const configured = resolveProducedAnalyticsContractVersion(
    process.env[PRODUCER_CONTRACT_VERSION_ENV],
  );
  if (!configured.ok) {
    throw new UnsupportedProducerContractVersionError(
      `${configured.error} Configured value: ` +
        `'${process.env[PRODUCER_CONTRACT_VERSION_ENV]}'.`,
    );
  }
}

/**
 * Which colour a single answer counts as in a question's distribution.
 *
 * The colour scale is the one scale whose points *are* statuses, so a colour
 * question reports the respondent's own choice and no band has any say in it.
 * Every other scale has no colour of its own, and its answer is reported by the
 * band its score falls in — the same `contracts/scoring-bands.json` the
 * dimension average uses, so a question and the stone above it cannot disagree
 * about where yellow starts.
 *
 * It used to take the nearest colour anchor by score instead, which was wrong
 * in a way nothing could see. The anchors score `100`/`60`/`0`, so nearest put
 * the crossovers at 80 and 30 while the shared bands put them at 75 and 50, and
 * the two disagree on exactly two of the scores the shipped scales produce —
 * both of them anchors a respondent clicks. `במידה רבה`, point 4 of 5, scores
 * 75: the bands call it green, nearest called it yellow. `לעיתים די רחוקות`,
 * point 3 of 7, scores 33: the bands call it red, nearest called it yellow.
 * Both errors pull toward the middle, which is the direction that hides a
 * finding rather than inventing one.
 *
 * The stone above those questions has always used the bands, so the old rule
 * could put eight green stones over questions whose every answer was counted
 * yellow — one screen answering the same question two ways.
 *
 * The colour scale never reached that branch, which is why this survived: it
 * was unreachable for the questionnaire that is running and wrong for the one
 * that is coming.
 *
 * The scale is passed in rather than inferred from the value. Inferring worked
 * only because no Likert scale happens to use `green` as a point value, and a
 * scale added later could break it silently.
 */
function bucketForAnswer(
  value: string,
  score: number,
  scaleId: AnswerScaleId,
): WellbeingStatus {
  if (scaleId === COLOUR_SCALE_ID) {
    const chosen = responseScale.find((option) => option.value === value);
    if (chosen) return chosen.value;
  }

  return statusForScore(score);
}

export class AnalyticsService {
  /**
   * Determine wellbeing status from an average numerical score (0-100). The
   * bands themselves live in `contracts/scoring-bands.json` and are shared with
   * the Python service, so this stays a delegation rather than a fourth copy.
   */
  public static computeStatus(score: number): WellbeingStatus {
    return statusForScore(score);
  }

  /**
   * Calculate aggregated analytics for a round from all submitted responses.
   * Enforces the privacy threshold, never below the required minimum. If total
   * responses < privacyThreshold,
   * results are marked as isLocked = true to preserve respondent anonymity.
   */
  public static calculateRoundAnalytics(
    roundId: string,
    storedPrivacyThreshold: number,
    responses: SurveyResponseRecord[]
  ): RoundAnalyticsResult {
    const privacyThreshold = effectivePrivacyThreshold(
      storedPrivacyThreshold,
    );
    const scopedResponses = responses.filter(
      (response) => response.roundId === roundId,
    );
    const totalResponses = scopedResponses.length;
    const calculatedAt = new Date();

    const scoresByQuestion = new Map<string, number[]>(
      surveyInstrument.questions.map((question) => [question.id, []]),
    );

    for (const response of scopedResponses) {
      const answeredQuestionIds = new Set<string>();

      for (const answer of response.answers) {
        const scores = scoresByQuestion.get(answer.questionId);
        if (!scores || answeredQuestionIds.has(answer.questionId)) continue;
        // The legacy path knows only the canonical 24, which are analytic and
        // therefore always scored. An unscored answer here is a background one
        // that does not belong to this exchange at all.
        if (answer.score === undefined) continue;

        scores.push(answer.score);
        answeredQuestionIds.add(answer.questionId);
      }
    }

    const isLocked =
      totalResponses < privacyThreshold ||
      surveyInstrument.questions.some(
        (question) =>
          (scoresByQuestion.get(question.id)?.length ?? 0) < privacyThreshold,
      );

    if (isLocked) {
      return {
        contractVersion: LEGACY_ANALYTICS_CONTRACT_VERSION,
        roundId,
        totalResponses,
        privacyThreshold,
        isLocked: true,
        dimensionScores: {} as Record<
          WellbeingDimensionId,
          RoundDimensionScore
        >,
        questionAggregates: {},
        calculatedAt,
      };
    }

    const average = (scores: number[]) =>
      Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length,
      );

    const questionAggregates: Record<string, QuestionAggregate> =
      Object.fromEntries(
        surveyInstrument.questions.map((question) => {
          const scores = scoresByQuestion.get(question.id) ?? [];

          return [
            question.id,
            {
              questionId: question.id,
              dimensionId: question.dimensionId,
              questionTextHebrew: question.text,
              averageScore: average(scores),
              responseCount: scores.length,
            },
          ];
        }),
      );

    const dimensionScores = {} as Record<
      WellbeingDimensionId,
      RoundDimensionScore
    >;

    for (const dimension of surveyInstrument.dimensions) {
      const scoresForDimension = dimension.questions.flatMap(
        (question) => scoresByQuestion.get(question.id) ?? [],
      );
      const averageScore = average(scoresForDimension);

      dimensionScores[dimension.id] = {
        dimensionId: dimension.id,
        averageScore,
        computedStatus: this.computeStatus(averageScore),
        totalResponses,
        isLocked: false,
        calculatedAt,
      };
    }

    return {
      contractVersion: LEGACY_ANALYTICS_CONTRACT_VERSION,
      roundId,
      totalResponses,
      privacyThreshold,
      isLocked: false,
      dimensionScores,
      questionAggregates,
      calculatedAt,
    };
  }

  /**
   * Calculate what Core knows about a round from the exact enabled
   * questionnaire snapshot persisted on it. The result carries no contract
   * version and hides nothing a version would hide; encoding it for the AI
   * service or for the manager API belongs to `../analytics-encoder`. Legacy
   * callers can continue using calculateRoundAnalytics for the immutable
   * canonical 2.0 shape.
   */
  /**
   * Everything a round's analytics need from its questionnaire, and nothing
   * from its answers.
   *
   * Separated because a round that is still collecting publishes no numbers:
   * its result is locked whatever the answers say, so it can be built from
   * this and a count. Reading every answer row to reach the same locked
   * payload is what made eight manager screens load a round's whole
   * collection to display one number.
   */
  private static readRoundQuestionnaire(round: SurveyRound) {
    const definition =
      round.surveyDefinition ??
      createCanonicalSurveyDefinition(round.title, round.privacyThreshold);
    // A draft round is allowed to hold an unfinished questionnaire: the manager
    // is still building it. Such a round simply has no results yet, so it must
    // parse and come back locked instead of throwing at every manager screen.
    const parsedDefinition = parseSurveyDefinition(definition, {
      allowIncomplete: true,
    });
    if (!parsedDefinition.ok) {
      throw new Error(`Invalid round survey definition: ${parsedDefinition.error}`);
    }

    return {
      // Analytic only, everywhere below. A background question is answered and
      // stored like any other, and it belongs on no stone: letting one reach
      // the aggregates would put a demographic answer into a dimension
      // average, and letting one reach the lock check would make an optional
      // question about commute time able to lock a school's whole result.
      enabledQuestions: parsedDefinition.value.questions
        .filter((question) => question.enabled)
        .filter(isAnalyticQuestion),
      isUnfinishedQuestionnaire: !isActivatableSurveyDefinition(
        parsedDefinition.value,
      ),
      surveyDefinitionHash: createSurveyDefinitionHash(
        parsedDefinition.value.questions,
      ),
      // Computed beside the AI-visible hash rather than derived from it: the
      // two read different fields of the same questions, and only this one can
      // tell a round answered on colours from the same round answered on a
      // Likert scale.
      measurementSnapshotHash: createMeasurementSnapshotHash(
        parsedDefinition.value.questions,
      ),
      privacyThreshold: effectivePrivacyThreshold(round.privacyThreshold),
    };
  }

  /**
   * The result of a round that publishes nothing, from its count alone.
   *
   * Every field here is a fact about the round or its questionnaire; the only
   * thing the answers contribute is how many there are. Kept beside the full
   * calculation and pinned by a test that runs both, because two ways of
   * producing the same payload is exactly how they drift.
   */
  public static lockedRoundAnalytics(
    round: SurveyRound,
    totalResponses: number,
  ): CanonicalRoundAnalytics {
    const questionnaire = this.readRoundQuestionnaire(round);

    return {
      roundId: round.id,
      organizationId: round.organizationId,
      surveyDefinitionHash: questionnaire.surveyDefinitionHash,
      measurementSnapshotHash: questionnaire.measurementSnapshotHash,
      totalResponses,
      privacyThreshold: questionnaire.privacyThreshold,
      isLocked: true,
      dimensionScores: {} as Record<
        WellbeingDimensionId,
        RoundDimensionScore
      >,
      questionAggregates: {},
      backgroundContext: round.backgroundContext,
      calculatedAt: new Date(),
    };
  }

  public static calculateDynamicRoundAnalytics(
    round: SurveyRound,
    responses: SurveyResponseRecord[],
  ): CanonicalRoundAnalytics {
    const {
      enabledQuestions,
      isUnfinishedQuestionnaire,
      surveyDefinitionHash,
      measurementSnapshotHash,
      privacyThreshold,
    } = this.readRoundQuestionnaire(round);
    const scopedResponses = responses.filter(
      (response) => response.roundId === round.id,
    );
    const totalResponses = scopedResponses.length;
    const calculatedAt = new Date();
    const questionsById = new Map(
      enabledQuestions.map((question) => [question.id, question]),
    );
    const scoresByQuestion = new Map<string, number[]>(
      enabledQuestions.map((question) => [question.id, []]),
    );
    const distributionsByQuestion = new Map<
      string,
      { green: number; yellow: number; red: number }
    >(
      enabledQuestions.map((question) => [
        question.id,
        { green: 0, yellow: 0, red: 0 },
      ]),
    );

    for (const response of scopedResponses) {
      // Which answers may be scored is decided in one place, because the
      // per-group breakdown of `../analytics/background-breakdown` is the same
      // arithmetic over a partition of these same responses and must not
      // disagree with this aggregate about what counts.
      for (const { question, answer, score } of readAnalyticAnswers(
        response,
        questionsById,
      )) {
        scoresByQuestion.get(answer.questionId)!.push(score);
        const dist = distributionsByQuestion.get(answer.questionId)!;
        dist[bucketForAnswer(answer.value, score, question.scaleId)]++;
      }
    }

    // A round publishes its numbers once, when it has stopped collecting.
    //
    // The threshold below protects one published set of respondents; it cannot
    // protect two. While answers keep arriving, every read is a fresh
    // publication basis, and two reads that straddle a single submission differ
    // by exactly one person: the difference of the per-question distributions
    // is that respondent's own answer sheet, and the difference of the group
    // counts is their demographic row. ADR-022 measured that leak and refused
    // to let a manager choose a second basis by excluding responses; the same
    // arithmetic works just as well when the second basis is chosen by waiting,
    // so the rule it settled on — a round has exactly one basis of calculation
    // — has to hold on the clock too. ADR-030 is where that is written down.
    //
    // Archived counts as published: archiving takes a round out of the list and
    // changes nothing about it (ADR-018). Withholding there would also make the
    // callback verifier recompute a locked round for a result that carries
    // detail, and reject Core's own correct analysis.
    const isLocked =
      isRoundCollecting(round.status) ||
      isUnfinishedQuestionnaire ||
      totalResponses < privacyThreshold ||
      enabledQuestions.some(
        (question) =>
          (scoresByQuestion.get(question.id)?.length ?? 0) < privacyThreshold,
      );

    if (isLocked) {
      return {
        roundId: round.id,
        organizationId: round.organizationId,
        surveyDefinitionHash,
        measurementSnapshotHash,
        totalResponses,
        privacyThreshold,
        isLocked: true,
        dimensionScores: {} as Record<
          WellbeingDimensionId,
          RoundDimensionScore
        >,
        questionAggregates: {},
        backgroundContext: round.backgroundContext,
        calculatedAt,
      };
    }

    const average = (scores: number[]) =>
      Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length,
      );
    const questionAggregates: Record<string, CanonicalQuestionAggregate> =
      Object.fromEntries(
        enabledQuestions.map((question) => {
          const scores = scoresByQuestion.get(question.id) ?? [];
          const dist = distributionsByQuestion.get(question.id) ?? {
            green: 0,
            yellow: 0,
            red: 0,
          };
          const aggregate: CanonicalQuestionAggregate = {
            questionId: question.id,
            dimensionId: question.dimensionId,
            questionText: question.text,
            averageScore: average(scores),
            responseCount: scores.length,
            scoreDistribution: { ...dist },
          };
          return [question.id, aggregate];
        }),
      );
    const dimensionScores = {} as Record<
      WellbeingDimensionId,
      RoundDimensionScore
    >;

    for (const dimension of surveyInstrument.dimensions) {
      const scoresForDimension = enabledQuestions
        .filter((question) => question.dimensionId === dimension.id)
        .flatMap((question) => scoresByQuestion.get(question.id) ?? []);
      const averageScore = average(scoresForDimension);

      dimensionScores[dimension.id] = {
        dimensionId: dimension.id,
        averageScore,
        computedStatus: this.computeStatus(averageScore),
        totalResponses,
        isLocked: false,
        calculatedAt,
      };
    }

    return {
      roundId: round.id,
      organizationId: round.organizationId,
      surveyDefinitionHash,
      measurementSnapshotHash,
      totalResponses,
      privacyThreshold,
      isLocked: false,
      dimensionScores,
      questionAggregates,
      backgroundContext: round.backgroundContext,
      calculatedAt,
    };
  }

  /**
   * Whether the numbers a round published still describe the round it is now.
   *
   * The stored copy is used only when everything the calculation consumed is
   * unchanged: how many responses there are, what the questionnaire asked, how
   * it was answered, and the threshold that decides whether any of it may be
   * shown. Anything else and the copy is ignored and replaced — a reset that
   * happens to end at the same count with the same questionnaire would
   * otherwise republish the erased round's numbers.
   */
  private static stillTheSameBasis(
    published: CanonicalRoundAnalytics,
    round: SurveyRound,
    questionnaire: ReturnType<typeof AnalyticsService.readRoundQuestionnaire>,
    totalResponses: number,
  ): boolean {
    return (
      published.roundId === round.id &&
      published.organizationId === round.organizationId &&
      published.totalResponses === totalResponses &&
      published.privacyThreshold === questionnaire.privacyThreshold &&
      // The measurement hash and not both hashes: it is computed from the same
      // questions as `surveyDefinitionHash` plus `scaleId` and `polarity`, so
      // it changes whenever that one does and comparing both would be one
      // comparison and one decoration. A test pins that relation, because the
      // day the projections stop overlapping this check quietly narrows.
      published.measurementSnapshotHash ===
        questionnaire.measurementSnapshotHash
    );
  }

  /**
   * A round's analytics, computed as rarely as they can honestly be.
   *
   * Three paths, in the order of how much they cost. A round that is still
   * collecting publishes nothing, so its locked result needs a count and not a
   * single answer row. A round that has stopped collecting has exactly one
   * basis of calculation (ADR-030), so the numbers it published are read back
   * instead of derived again. Only a round with no usable copy loads its
   * responses, and it stores what it computed on the way out.
   *
   * Before this, every one of these read every `SurveyResponse` of the round
   * with all its answers — some 38 000 rows for 300 staff on the 126-question
   * instrument — on every manager screen, up to four more times for the
   * dashboard's comparison, and again for every AI request.
   */
  public static async getAnalyticsForRound(
    roundId: string,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository
  ): Promise<CanonicalRoundAnalytics | null> {
    const round = await roundRepo.findById(roundId);
    if (!round) return null;

    const totalResponses = await surveyRepo.getResponseCount(roundId);
    if (isRoundCollecting(round.status)) {
      return this.lockedRoundAnalytics(round, totalResponses);
    }

    const questionnaire = this.readRoundQuestionnaire(round);
    const published = await roundRepo.findPublishedAnalytics(roundId);
    if (
      published &&
      this.stillTheSameBasis(published, round, questionnaire, totalResponses)
    ) {
      // The school context is the round's, always. It is not one of the
      // numbers, it can be edited after the round closed, and the stored copy
      // deliberately does not carry it.
      return { ...published, backgroundContext: round.backgroundContext };
    }

    const responses = await surveyRepo.findResponsesByRoundId(roundId);
    const analytics = this.calculateDynamicRoundAnalytics(round, responses);
    await roundRepo.savePublishedAnalytics(roundId, analytics);
    return analytics;
  }
}
