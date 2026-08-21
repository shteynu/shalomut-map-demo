import type { WellbeingDimensionId } from '../shalomut-source';
import type {
  MeasurementSnapshotHash,
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
 * for a boundary to remember. A round is locked below the privacy threshold and
 * also while it is still collecting, because a round that keeps filling up
 * would otherwise publish a new basis of calculation on every read (ADR-030).
 * Why it is locked is not carried here — the screens that explain it hold the
 * round itself, and `isRoundCollecting` is the one predicate they share.
 */
export interface CanonicalRoundAnalytics {
  roundId: string;
  organizationId: string;
  surveyDefinitionHash: SurveyDefinitionHash;
  /**
   * What this round measured, for deciding whether a delta against another
   * round is like for like. Required rather than optional on purpose: two
   * rounds that both left it undefined would compare equal and be reported as
   * the same questionnaire, which is the exact silence this field was added to
   * end.
   *
   * Core-side only — `encodeAnalyticsInput` names the keys that cross the wire
   * and this is not one of them.
   */
  measurementSnapshotHash: MeasurementSnapshotHash;
  totalResponses: number;
  privacyThreshold: number;
  isLocked: boolean;
  dimensionScores: Record<WellbeingDimensionId, RoundDimensionScore>;
  questionAggregates: Record<string, CanonicalQuestionAggregate>;
  /** The school context the manager entered, when the round has one. */
  backgroundContext?: RoundBackgroundContext;
  calculatedAt: Date;
}
