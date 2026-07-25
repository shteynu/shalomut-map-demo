import { IRoundRepository, ISurveyRepository } from '../repositories/interfaces';
import {
  WellbeingDimensionId,
  WellbeingStatus,
  surveyInstrument,
} from '../shalomut-source';
import {
  QuestionAggregate,
  RoundAnalyticsResult,
  RoundDimensionScore,
  SurveyResponseRecord,
} from '../types/backend';

export class AnalyticsService {
  /**
   * Determine wellbeing status from average numerical score (0-100)
   * - Green: 75..100
   * - Yellow: 50..74
   * - Red: 0..49
   */
  public static computeStatus(score: number): WellbeingStatus {
    if (score >= 75) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
  }

  /**
   * Calculate aggregated analytics for a round from all submitted responses.
   * Enforces privacy threshold (default 10). If total responses < privacyThreshold,
   * results are marked as isLocked = true to preserve respondent anonymity.
   */
  public static calculateRoundAnalytics(
    roundId: string,
    privacyThreshold: number,
    responses: SurveyResponseRecord[]
  ): RoundAnalyticsResult {
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
        contractVersion: '2.0',
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
      contractVersion: '2.0',
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
   * Fetch round metadata and responses from repositories, then compute analytics
   */
  public static async getAnalyticsForRound(
    roundId: string,
    roundRepo: IRoundRepository,
    surveyRepo: ISurveyRepository
  ): Promise<RoundAnalyticsResult | null> {
    const round = await roundRepo.findById(roundId);
    if (!round) return null;

    const responses = await surveyRepo.findResponsesByRoundId(roundId);
    return this.calculateRoundAnalytics(
      roundId,
      round.privacyThreshold,
      responses
    );
  }
}
