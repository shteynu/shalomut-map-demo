import { getProducedAnalyticsContractVersion } from './ai-contract-version';
import { getCapabilities } from './contract-registry';
import { COLOUR_SCALE_ID } from './survey/answer-scales';
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
        if (capabilities.carriesAnswerScale) {
          encoded.scaleId = aggregate.scaleId;
          encoded.polarity = aggregate.polarity;
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
/**
 * The produced version cannot describe this round to the AI service.
 *
 * A statement answered on a Likert scale has a polarity the average already
 * absorbed, and a version without `carriesAnswerScale` would hand the model
 * that average as if it were a colour count and ask for a narrative per
 * question — for the research instrument, over a hundred of them. Refusing
 * here fails the analysis run closed at the boundary, before a provider call
 * is paid for, and names the configuration that has to change. The manager
 * API and the callback verifier are not behind this: a round on the
 * instrument still reads on every screen, and only its analysis waits.
 */
export class ContractCannotCarryQuestionnaireError extends Error {
  constructor(contractVersion: string, scaleId: string) {
    super(
      `Analytics contract ${contractVersion} cannot carry a questionnaire ` +
        `answered on ${scaleId}: select a version with carriesAnswerScale ` +
        `(7.0 or later) in ${'AI_ANALYTICS_CONTRACT_VERSION'}.`,
    );
    this.name = 'ContractCannotCarryQuestionnaireError';
  }
}

export function encodeAnalyticsInput(
  canonical: CanonicalRoundAnalytics,
  contractVersion: string = getProducedAnalyticsContractVersion(),
): Record<string, unknown> {
  const capabilities = getCapabilities(contractVersion);
  if (!capabilities.carriesAnswerScale) {
    const foreign = Object.values(canonical.questionAggregates).find(
      (aggregate) => aggregate.scaleId !== COLOUR_SCALE_ID,
    );
    if (foreign) {
      throw new ContractCannotCarryQuestionnaireError(
        contractVersion,
        foreign.scaleId,
      );
    }
  }
  const encoded = encodeRoundAnalytics(canonical, contractVersion);
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
