import { getProducedAnalyticsContractVersion } from './ai-contract-version';
import { getCapabilities } from './contract-registry';
import type {
  DynamicQuestionAggregate,
  RoundAnalyticsV3Result,
} from './types/backend';
import type { CanonicalRoundAnalytics } from './types/canonical-analytics';

/**
 * Turns what Core computed into what a given contract version describes.
 *
 * The domain calculation says nothing about versions; every question of the
 * form "does this version carry that field" is answered here, once, against
 * the shared capability manifest. Everything Core owns and recomputes — the
 * averages, the statuses, the response counts — crosses unchanged, because a
 * contract version decides what is sent, never what is true.
 */
export function encodeRoundAnalytics(
  canonical: CanonicalRoundAnalytics,
  contractVersion: string = getProducedAnalyticsContractVersion(),
): RoundAnalyticsV3Result {
  const capabilities = getCapabilities(contractVersion);

  const questionAggregates: Record<string, DynamicQuestionAggregate> =
    Object.fromEntries(
      Object.entries(canonical.questionAggregates).map(([id, aggregate]) => {
        const encoded: DynamicQuestionAggregate = {
          questionId: aggregate.questionId,
          dimensionId: aggregate.dimensionId,
          questionText: aggregate.questionText,
          averageScore: aggregate.averageScore,
          responseCount: aggregate.responseCount,
        };
        if (capabilities.supportsScoreDistribution) {
          encoded.scoreDistribution = { ...aggregate.scoreDistribution };
        }
        return [id, encoded];
      }),
    );

  return {
    contractVersion:
      contractVersion as RoundAnalyticsV3Result['contractVersion'],
    roundId: canonical.roundId,
    organizationId: canonical.organizationId,
    surveyDefinitionHash: canonical.surveyDefinitionHash,
    totalResponses: canonical.totalResponses,
    privacyThreshold: canonical.privacyThreshold,
    isLocked: canonical.isLocked,
    dimensionScores: canonical.dimensionScores,
    questionAggregates,
    calculatedAt: canonical.calculatedAt,
  };
}

/**
 * The payload the AI service actually receives over MCP: the encoded analytics
 * plus the two things only the wire needs — a serialised timestamp and, on
 * versions that support it, the school background context.
 *
 * A locked round never carries that context. The provider is not called for
 * it, so nothing about the school has a reason to cross the boundary.
 */
export function encodeAnalyticsInput(
  canonical: CanonicalRoundAnalytics,
  contractVersion: string = getProducedAnalyticsContractVersion(),
): Record<string, unknown> {
  const encoded = encodeRoundAnalytics(canonical, contractVersion);
  const capabilities = getCapabilities(contractVersion);
  const includesBackgroundContext =
    capabilities.supportsBackgroundContext && !encoded.isLocked;

  return {
    contractVersion: encoded.contractVersion,
    roundId: encoded.roundId,
    organizationId: encoded.organizationId,
    surveyDefinitionHash: encoded.surveyDefinitionHash,
    totalResponses: encoded.totalResponses,
    privacyThreshold: encoded.privacyThreshold,
    isLocked: encoded.isLocked,
    dimensionScores: encoded.dimensionScores,
    questionAggregates: encoded.questionAggregates,
    backgroundContext: includesBackgroundContext
      ? (canonical.backgroundContext ?? undefined)
      : undefined,
    calculatedAt: encoded.calculatedAt.toISOString(),
  };
}
