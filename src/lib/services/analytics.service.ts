import { IRoundRepository, ISurveyRepository } from '../repositories/interfaces';
import {
  WellbeingDimensionId,
  WellbeingStatus,
  surveyInstrument,
} from '../shalomut-source';
import {
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
    const totalResponses = responses.length;
    const isLocked = totalResponses < privacyThreshold;
    const calculatedAt = new Date();

    const allDimensionIds = surveyInstrument.dimensions.map((d) => d.id);
    const dimensionScores: Record<string, RoundDimensionScore> = {};

    for (const dimId of allDimensionIds) {
      if (isLocked) {
        dimensionScores[dimId] = {
          dimensionId: dimId,
          averageScore: 0,
          computedStatus: 'yellow', // default neutral status when locked
          totalResponses,
          isLocked: true,
          calculatedAt,
        };
      } else {
        // Gather all answer scores for this dimension across all responses
        const scoresForDim: number[] = [];

        for (const response of responses) {
          for (const answer of response.answers) {
            if (answer.dimensionId === dimId) {
              scoresForDim.push(answer.score);
            }
          }
        }

        const avgScore =
          scoresForDim.length > 0
            ? Math.round(
                scoresForDim.reduce((acc, curr) => acc + curr, 0) /
                  scoresForDim.length
              )
            : 0;

        dimensionScores[dimId] = {
          dimensionId: dimId,
          averageScore: avgScore,
          computedStatus: this.computeStatus(avgScore),
          totalResponses,
          isLocked: false,
          calculatedAt,
        };
      }
    }

    return {
      roundId,
      totalResponses,
      privacyThreshold,
      isLocked,
      dimensionScores: dimensionScores as Record<
        WellbeingDimensionId,
        RoundDimensionScore
      >,
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

