import type { WellbeingDimensionId } from '../shalomut-source';
import type {
  RoundBackgroundContext,
  RoundDimensionScore,
  SurveyDefinitionHash,
} from './backend';

/**
 * What Core knows about one question of one round, before any contract has an
 * opinion about it. The distribution is always here: whether it reaches the AI
 * service is a property of the contract version, not of the calculation.
 */
export interface CanonicalQuestionAggregate {
  questionId: string;
  dimensionId: WellbeingDimensionId;
  questionText: string;
  averageScore: number;
  responseCount: number;
  scoreDistribution: {
    green: number;
    yellow: number;
    red: number;
  };
}

/**
 * The round as Core computed it — no contract version, no wire shape. Encoders
 * in the contract package turn this into the versioned payloads the AI service
 * and the manager API receive, which is what keeps `AnalyticsService` free of
 * questions like "does this version carry distributions".
 *
 * A locked round carries empty `dimensionScores` and `questionAggregates`: the
 * privacy gate is a property of the round, so it is decided here and not left
 * for a boundary to remember.
 */
export interface CanonicalRoundAnalytics {
  roundId: string;
  organizationId: string;
  surveyDefinitionHash: SurveyDefinitionHash;
  totalResponses: number;
  privacyThreshold: number;
  isLocked: boolean;
  dimensionScores: Record<WellbeingDimensionId, RoundDimensionScore>;
  questionAggregates: Record<string, CanonicalQuestionAggregate>;
  /** The school context the manager entered, when the round has one. */
  backgroundContext?: RoundBackgroundContext;
  calculatedAt: Date;
}
