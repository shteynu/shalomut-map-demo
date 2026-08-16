import { readAnalyticAnswers } from '../analytics/analytic-answers';
import {
  LEGACY_ANALYTICS_CONTRACT_VERSION,
  PRODUCER_CONTRACT_VERSION_ENV,
  UnsupportedProducerContractVersionError,
  getProducedAnalyticsContractVersion,
  resolveProducedAnalyticsContractVersion,
} from '../ai-contract-version';
import { IRoundRepository, ISurveyRepository } from '../repositories/interfaces';
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
  public static calculateDynamicRoundAnalytics(
    round: SurveyRound,
    responses: SurveyResponseRecord[],
  ): CanonicalRoundAnalytics {
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

    // Analytic only, everywhere below. A background question is answered and
    // stored like any other, and it belongs on no stone: letting one reach the
    // aggregates would put a demographic answer into a dimension average, and
    // letting one reach the lock check would make an optional question about
    // commute time able to lock a school's whole result.
    const enabledQuestions = parsedDefinition.value.questions
      .filter((question) => question.enabled)
      .filter(isAnalyticQuestion);
    const isUnfinishedQuestionnaire = !isActivatableSurveyDefinition(
      parsedDefinition.value,
    );
    const surveyDefinitionHash = createSurveyDefinitionHash(
      parsedDefinition.value.questions,
    );
    // Computed beside the AI-visible hash rather than derived from it: the two
    // read different fields of the same questions, and only this one can tell
    // a round answered on colours from the same round answered on a Likert
    // scale.
    const measurementSnapshotHash = createMeasurementSnapshotHash(
      parsedDefinition.value.questions,
    );
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

    const privacyThreshold = effectivePrivacyThreshold(
      round.privacyThreshold,
    );
    const isLocked =
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
   * Fetch round metadata and responses from repositories, then compute analytics
   */
  public static async getAnalyticsForRound(
    roundId: string,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository
  ): Promise<CanonicalRoundAnalytics | null> {
    const round = await roundRepo.findById(roundId);
    if (!round) return null;

    const responses = await surveyRepo.findResponsesByRoundId(roundId);
    return this.calculateDynamicRoundAnalytics(round, responses);
  }
}
