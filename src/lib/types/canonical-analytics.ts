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
 * Why a round's numbers are withheld, or `null` when they are published.
 *
 * The reason exists because the screens have to say something true. A locked
 * round used to be a bare boolean, and every screen re-derived the cause by
 * comparing the response count to the threshold — which was the only cause
 * there was until a round could also be locked for having arrived too early.
 * A manager looking at seventeen responses against a threshold of ten would
 * otherwise be told they need another zero.
 *
 * `still-collecting` is the one that is not about how many answers came back.
 * It is about how many times the round has been published: see ADR-030.
 */
export type RoundLockReason =
  | 'still-collecting'
  | 'below-threshold'
  | 'question-below-threshold'
  | 'unfinished-questionnaire';

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
  /**
   * Why `isLocked` is true, and `null` exactly when it is false.
   *
   * Core-side only, like `measurementSnapshotHash` above:
   * `encodeAnalyticsInput` names the keys that cross the wire and this is not
   * one of them. The AI service is told whether a round is locked, which is
   * all it can act on — it is never called for a locked round at all.
   */
  lockReason: RoundLockReason | null;
  dimensionScores: Record<WellbeingDimensionId, RoundDimensionScore>;
  questionAggregates: Record<string, CanonicalQuestionAggregate>;
  /** The school context the manager entered, when the round has one. */
  backgroundContext?: RoundBackgroundContext;
  calculatedAt: Date;
}
