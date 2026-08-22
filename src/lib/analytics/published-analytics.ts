/**
 * A round's published numbers, on their way to and from a JSON column.
 *
 * A round that has stopped collecting has exactly one basis of calculation
 * (ADR-030), so its analytics are a fact about the round rather than a fresh
 * answer to every reader. This is how that fact is written down and read back.
 *
 * Decoding is strict and forgiving at the same time: strict because a blob that
 * does not carry every field of `CanonicalRoundAnalytics` cannot be served as
 * one, forgiving because the answer to a blob it cannot read is `null` — the
 * caller recomputes from the responses and stores the result again. That is
 * what makes an older or hand-edited row a slow read instead of a wrong one.
 *
 * One field is deliberately absent: `backgroundContext`. It is what the manager
 * typed about the school, not something the answers produced, and it can be
 * edited after the round has closed. Storing it would give the same fact two
 * homes and let the copy go stale, so a decoded result carries no context and
 * `AnalyticsService` reads the round's own — which is where the calculation
 * reads it from too.
 */
import type { WellbeingDimensionId } from '../shalomut-source';
import type {
  MeasurementSnapshotHash,
  RoundDimensionScore,
  SurveyDefinitionHash,
} from '../types/backend';
import type {
  CanonicalQuestionAggregate,
  CanonicalRoundAnalytics,
} from '../types/canonical-analytics';

/**
 * The shape as it sits in the column: every `Date` an ISO string, and nothing
 * else changed. Named so a reader of the row knows what produced it and a
 * future field addition can be told apart from a truncated write.
 */
export const PUBLISHED_ANALYTICS_FORMAT = 'canonical-round-analytics/1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readDimensionScore(value: unknown): RoundDimensionScore | null {
  if (!isRecord(value)) return null;
  const calculatedAt = readDate(value.calculatedAt);
  if (
    typeof value.dimensionId !== 'string' ||
    typeof value.averageScore !== 'number' ||
    typeof value.computedStatus !== 'string' ||
    typeof value.totalResponses !== 'number' ||
    typeof value.isLocked !== 'boolean' ||
    !calculatedAt
  ) {
    return null;
  }

  return {
    dimensionId: value.dimensionId as WellbeingDimensionId,
    averageScore: value.averageScore,
    computedStatus: value.computedStatus as RoundDimensionScore['computedStatus'],
    totalResponses: value.totalResponses,
    isLocked: value.isLocked,
    calculatedAt,
  };
}

function readQuestionAggregate(
  value: unknown,
): CanonicalQuestionAggregate | null {
  if (!isRecord(value)) return null;
  const distribution = value.scoreDistribution;
  if (
    typeof value.questionId !== 'string' ||
    typeof value.dimensionId !== 'string' ||
    typeof value.questionText !== 'string' ||
    typeof value.averageScore !== 'number' ||
    typeof value.responseCount !== 'number' ||
    !isRecord(distribution) ||
    typeof distribution.green !== 'number' ||
    typeof distribution.yellow !== 'number' ||
    typeof distribution.red !== 'number'
  ) {
    return null;
  }

  return {
    questionId: value.questionId,
    dimensionId: value.dimensionId as WellbeingDimensionId,
    questionText: value.questionText,
    averageScore: value.averageScore,
    responseCount: value.responseCount,
    scoreDistribution: {
      green: distribution.green,
      yellow: distribution.yellow,
      red: distribution.red,
    },
  };
}

export function encodePublishedAnalytics(
  analytics: CanonicalRoundAnalytics,
): Record<string, unknown> {
  return {
    format: PUBLISHED_ANALYTICS_FORMAT,
    roundId: analytics.roundId,
    organizationId: analytics.organizationId,
    surveyDefinitionHash: analytics.surveyDefinitionHash,
    measurementSnapshotHash: analytics.measurementSnapshotHash,
    totalResponses: analytics.totalResponses,
    privacyThreshold: analytics.privacyThreshold,
    isLocked: analytics.isLocked,
    dimensionScores: Object.fromEntries(
      Object.entries(analytics.dimensionScores).map(([id, score]) => [
        id,
        { ...score, calculatedAt: score.calculatedAt.toISOString() },
      ]),
    ),
    questionAggregates: Object.fromEntries(
      Object.entries(analytics.questionAggregates).map(([id, aggregate]) => [
        id,
        { ...aggregate, scoreDistribution: { ...aggregate.scoreDistribution } },
      ]),
    ),
    calculatedAt: analytics.calculatedAt.toISOString(),
  };
}

export function decodePublishedAnalytics(
  stored: unknown,
): CanonicalRoundAnalytics | null {
  if (!isRecord(stored) || stored.format !== PUBLISHED_ANALYTICS_FORMAT) {
    return null;
  }

  const calculatedAt = readDate(stored.calculatedAt);
  if (
    typeof stored.roundId !== 'string' ||
    typeof stored.organizationId !== 'string' ||
    typeof stored.surveyDefinitionHash !== 'string' ||
    typeof stored.measurementSnapshotHash !== 'string' ||
    typeof stored.totalResponses !== 'number' ||
    typeof stored.privacyThreshold !== 'number' ||
    typeof stored.isLocked !== 'boolean' ||
    !isRecord(stored.dimensionScores) ||
    !isRecord(stored.questionAggregates) ||
    !calculatedAt
  ) {
    return null;
  }

  const dimensionScores = {} as Record<
    WellbeingDimensionId,
    RoundDimensionScore
  >;
  for (const [id, value] of Object.entries(stored.dimensionScores)) {
    const score = readDimensionScore(value);
    if (!score) return null;
    dimensionScores[id as WellbeingDimensionId] = score;
  }

  const questionAggregates: Record<string, CanonicalQuestionAggregate> = {};
  for (const [id, value] of Object.entries(stored.questionAggregates)) {
    const aggregate = readQuestionAggregate(value);
    if (!aggregate) return null;
    questionAggregates[id] = aggregate;
  }

  return {
    roundId: stored.roundId,
    organizationId: stored.organizationId,
    surveyDefinitionHash: stored.surveyDefinitionHash as SurveyDefinitionHash,
    measurementSnapshotHash:
      stored.measurementSnapshotHash as MeasurementSnapshotHash,
    totalResponses: stored.totalResponses,
    privacyThreshold: stored.privacyThreshold,
    isLocked: stored.isLocked,
    dimensionScores,
    questionAggregates,
    calculatedAt,
  };
}
