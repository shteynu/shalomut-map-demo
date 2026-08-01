import { getCapabilities, isVersionSupported } from './contract-registry';

export type RoundAnalyticsPayloadValidation =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isInteger(value: unknown, minimum: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum
  );
}

export function validateRoundAnalyticsPayload(
  value: unknown,
): RoundAnalyticsPayloadValidation {
  if (!isRecord(value)) {
    return { ok: false, error: 'Round analytics payload must be an object' };
  }
  const version = value.contractVersion;
  if (typeof version !== 'string' || !isVersionSupported(version)) {
    return { ok: false, error: 'Unsupported round analytics contract version' };
  }
  if (
    typeof value.roundId !== 'string' ||
    !value.roundId ||
    !isInteger(value.totalResponses, 0) ||
    !isInteger(value.privacyThreshold, 1) ||
    typeof value.isLocked !== 'boolean' ||
    !isRecord(value.dimensionScores) ||
    !isRecord(value.questionAggregates) ||
    typeof value.calculatedAt !== 'string' ||
    !value.calculatedAt
  ) {
    return { ok: false, error: 'Round analytics payload has invalid common fields' };
  }

  const capabilities = getCapabilities(version);
  if (
    capabilities.supportsDynamicQuestions &&
    (typeof value.organizationId !== 'string' ||
      !value.organizationId ||
      typeof value.surveyDefinitionHash !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(value.surveyDefinitionHash))
  ) {
    return { ok: false, error: 'Dynamic analytics metadata is invalid' };
  }

  for (const [dimensionId, score] of Object.entries(value.dimensionScores)) {
    if (
      !isRecord(score) ||
      score.dimensionId !== dimensionId ||
      typeof score.averageScore !== 'number' ||
      !Number.isFinite(score.averageScore) ||
      !['green', 'yellow', 'red'].includes(String(score.computedStatus))
    ) {
      return { ok: false, error: `Invalid dimension score: ${dimensionId}` };
    }
  }

  for (const [questionId, aggregate] of Object.entries(value.questionAggregates)) {
    if (
      !isRecord(aggregate) ||
      typeof aggregate.averageScore !== 'number' ||
      !Number.isFinite(aggregate.averageScore) ||
      !isInteger(aggregate.responseCount, 0)
    ) {
      return { ok: false, error: `Invalid question aggregate: ${questionId}` };
    }
    if (capabilities.supportsDynamicQuestions) {
      if (
        aggregate.questionId !== questionId ||
        typeof aggregate.dimensionId !== 'string' ||
        typeof aggregate.questionText !== 'string'
      ) {
        return { ok: false, error: `Invalid dynamic question aggregate: ${questionId}` };
      }
    }
    if (capabilities.supportsScoreDistribution) {
      const distribution = aggregate.scoreDistribution;
      if (
        !isRecord(distribution) ||
        !isInteger(distribution.green, 0) ||
        !isInteger(distribution.yellow, 0) ||
        !isInteger(distribution.red, 0)
      ) {
        return { ok: false, error: `Invalid score distribution: ${questionId}` };
      }
    }
  }

  return { ok: true, value };
}
