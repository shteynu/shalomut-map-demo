import {
  LEGACY_ANALYTICS_CONTRACT_VERSION,
  PRODUCER_CONTRACT_VERSION_ENV,
  UnsupportedProducerContractVersionError,
  getProducedAnalyticsContractVersion,
  resolveProducedAnalyticsContractVersion,
} from '../ai-contract-version';
import { IRoundRepository, ISurveyRepository } from '../repositories/interfaces';
import { statusForScore } from '../scoring-bands';
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
import { createSurveyDefinitionHash } from '../survey-definition-hash';
import {
  QuestionAggregate,
  QuestionAnswerRecord,
  RoundAnalyticsResult,
  RoundDimensionScore,
  SurveyResponseRecord,
  SurveyRound,
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
 * This is the respondent's own choice rather than an aggregation, so the shared
 * score bands have no say here: a distribution reports what people picked. The
 * score fallback covers a stored row whose value is not one of the three, and
 * it reads the response scale that produced the score in the first place.
 */
function bucketForAnswer(answer: QuestionAnswerRecord): WellbeingStatus {
  const chosen = responseScale.find((option) => option.value === answer.value);
  if (chosen) return chosen.value;

  return responseScale.reduce((closest, option) =>
    Math.abs(option.score - answer.score) <
    Math.abs(closest.score - answer.score)
      ? option
      : closest,
  ).value;
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

    const enabledQuestions = parsedDefinition.value.questions.filter(
      (question) => question.enabled,
    );
    const isUnfinishedQuestionnaire = !isActivatableSurveyDefinition(
      parsedDefinition.value,
    );
    const surveyDefinitionHash = createSurveyDefinitionHash(enabledQuestions);
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
      const answeredQuestionIds = new Set<string>();

      for (const answer of response.answers) {
        const question = questionsById.get(answer.questionId);
        if (
          !question ||
          answeredQuestionIds.has(answer.questionId) ||
          answer.dimensionId !== question.dimensionId ||
          !Number.isFinite(answer.score) ||
          answer.score < 0 ||
          answer.score > 100
        ) {
          continue;
        }

        scoresByQuestion.get(answer.questionId)!.push(answer.score);
        const dist = distributionsByQuestion.get(answer.questionId)!;
        dist[bucketForAnswer(answer)]++;
        answeredQuestionIds.add(answer.questionId);
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
