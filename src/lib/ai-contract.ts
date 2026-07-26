import legacyContractManifest from '../../contracts/ai-analytics-v1.json';
import contractManifest from '../../contracts/ai-analytics-v2.json';
import dynamicContractManifest from '../../contracts/ai-analytics-v3.json';
import v4ContractManifest from '../../contracts/ai-analytics-v4.json';
import type {
  WellbeingDimensionId,
  WellbeingStatus,
} from './shalomut-source';

export const AI_ANALYTICS_V1_CONTRACT_VERSION = legacyContractManifest.version;
export const AI_ANALYTICS_CONTRACT_VERSION = contractManifest.version;
export const AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION =
  dynamicContractManifest.version;
export const AI_ANALYTICS_V4_CONTRACT_VERSION = v4ContractManifest.version;

export const AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS = Object.freeze([
  AI_ANALYTICS_V1_CONTRACT_VERSION,
  AI_ANALYTICS_CONTRACT_VERSION,
  AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
  AI_ANALYTICS_V4_CONTRACT_VERSION,
]);

export type AiAnalyticsContractVersion =
  (typeof AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS)[number];

export type AiAnalyticsKnownContractVersion =
  AiAnalyticsContractVersion;

export const AI_ANALYTICS_DIMENSION_IDS = Object.freeze(
  contractManifest.dimensions.map(
    (dimension) => dimension.id as WellbeingDimensionId,
  ),
);

export const AI_ANALYTICS_DIMENSION_NAMES_HEBREW = Object.freeze(
  Object.fromEntries(
    contractManifest.dimensions.map((dimension) => [
      dimension.id,
      dimension.nameHebrew,
    ]),
  ) as Record<WellbeingDimensionId, string>,
);

export interface CanonicalAiQuestion {
  id: string;
  dimensionId: WellbeingDimensionId;
  textHebrew: string;
}

export const AI_ANALYTICS_QUESTIONS = Object.freeze(
  contractManifest.dimensions.flatMap((dimension) =>
    dimension.questions.map(
      (question): CanonicalAiQuestion => ({
        id: question.id,
        dimensionId: dimension.id as WellbeingDimensionId,
        textHebrew: question.textHebrew,
      }),
    ),
  ),
);

export const AI_ANALYTICS_QUESTION_IDS = Object.freeze(
  AI_ANALYTICS_QUESTIONS.map((question) => question.id),
);

export const AI_ANALYTICS_QUESTIONS_BY_ID = Object.freeze(
  Object.fromEntries(
    AI_ANALYTICS_QUESTIONS.map((question) => [question.id, question]),
  ) as Record<string, CanonicalAiQuestion>,
);

export interface StoneMetric {
  label: string;
  value: string;
  trend?: string;
  questionId?: string;
  averageScore?: number;
  responseCount?: number;
}

export interface StoneIntervention {
  id: string;
  dimensionId: WellbeingDimensionId;
  status?: WellbeingStatus;
  source: string;
  title: string;
  summary: string;
  actionable_steps: string[];
}

export interface StoneGenerationProvenance {
  outcome: 'llm' | 'deterministic_fallback';
  attempts: number;
  retryCount: number;
  sourceQuestionIds: string[];
  surveyDefinitionHash?: string;
  backgroundContextIncluded?: boolean;
}

export interface StoneDetail {
  dimensionId: WellbeingDimensionId;
  dimensionNameHebrew: string;
  status: WellbeingStatus;
  score: number;
  psychologicalInterpretation: string;
  recommendedInterventions: StoneIntervention[];
  metrics: StoneMetric[];
  generationProvenance?: StoneGenerationProvenance;
}

export interface StoneMapResult {
  contractVersion: AiAnalyticsKnownContractVersion;
  roundId: string;
  processedAt?: string;
  surveyDefinitionHash?: string;
  isLocked: boolean;
  status: 'success' | 'locked_error' | 'validation_failed';
  errorMessage?: string;
  overallPsychologicalSummary?: string;
  stones?: Record<WellbeingDimensionId, StoneDetail>;
}

export type StoneMapValidationResult =
  | { ok: true; value: StoneMapResult }
  | { ok: false; error: string };

const WELLBEING_STATUSES = new Set<WellbeingStatus>([
  'green',
  'yellow',
  'red',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isLegacyMetric(value: unknown): value is StoneMetric {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.value === 'string' &&
    (value.trend === undefined || typeof value.trend === 'string')
  );
}

function isLegacyIntervention(value: unknown): value is StoneIntervention {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    AI_ANALYTICS_DIMENSION_IDS.includes(
      value.dimensionId as WellbeingDimensionId,
    ) &&
    typeof value.source === 'string' &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    isStringArray(value.actionable_steps)
  );
}

function hasValidStoneShape(
  value: unknown,
  dimensionId: WellbeingDimensionId,
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.dimensionId === dimensionId &&
    typeof value.dimensionNameHebrew === 'string' &&
    WELLBEING_STATUSES.has(value.status as WellbeingStatus) &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score) &&
    value.score >= 0 &&
    value.score <= 100 &&
    typeof value.psychologicalInterpretation === 'string' &&
    Array.isArray(value.recommendedInterventions) &&
    Array.isArray(value.metrics)
  );
}

function isValidLegacyStone(
  value: unknown,
  dimensionId: WellbeingDimensionId,
): value is StoneDetail {
  if (!hasValidStoneShape(value, dimensionId)) {
    return false;
  }

  const interventions = value.recommendedInterventions as unknown[];
  const metrics = value.metrics as unknown[];

  return (
    interventions.every(
      (intervention) =>
        isLegacyIntervention(intervention) &&
        intervention.dimensionId === dimensionId,
    ) && metrics.every(isLegacyMetric)
  );
}

function containsOnlyHebrewUserText(value: string): boolean {
  return /[\u0590-\u05ff]/u.test(value) && !/[A-Za-z]/u.test(value);
}

function hasExactlyTwoCompleteSentences(value: string): boolean {
  const normalized = value.trim();
  const sentences = normalized.match(/[^.!?؟]+[.!?؟]/gu) ?? [];
  return (
    sentences.length === 2 &&
    sentences.join('').replace(/\s/gu, '') === normalized.replace(/\s/gu, '')
  );
}

function statusForScore(score: number): WellbeingStatus {
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

function canonicalQuestionsForDimension(
  dimensionId: WellbeingDimensionId,
): CanonicalAiQuestion[] {
  return AI_ANALYTICS_QUESTIONS.filter(
    (question) => question.dimensionId === dimensionId,
  );
}

function isValidQuestionMetric(
  value: unknown,
  question: CanonicalAiQuestion,
): value is StoneMetric {
  return (
    isRecord(value) &&
    value.questionId === question.id &&
    value.label === question.textHebrew &&
    typeof value.value === 'string' &&
    containsOnlyHebrewUserText(value.value) &&
    typeof value.averageScore === 'number' &&
    Number.isFinite(value.averageScore) &&
    value.averageScore >= 0 &&
    value.averageScore <= 100 &&
    Number.isInteger(value.responseCount) &&
    Number(value.responseCount) > 0 &&
    (value.trend === undefined ||
      (typeof value.trend === 'string' &&
        containsOnlyHebrewUserText(value.trend)))
  );
}

function isValidV2Intervention(
  value: unknown,
  dimensionId: WellbeingDimensionId,
  status: WellbeingStatus,
): value is StoneIntervention {
  return (
    isLegacyIntervention(value) &&
    value.dimensionId === dimensionId &&
    value.status === status &&
    containsOnlyHebrewUserText(value.title) &&
    containsOnlyHebrewUserText(value.summary) &&
    value.actionable_steps.length > 0 &&
    value.actionable_steps.every(containsOnlyHebrewUserText)
  );
}

function isValidGenerationProvenance(
  value: unknown,
  dimensionId: WellbeingDimensionId,
): value is StoneGenerationProvenance {
  if (!isRecord(value)) return false;

  const questionIds = canonicalQuestionsForDimension(dimensionId).map(
    (question) => question.id,
  );
  if (
    !['llm', 'deterministic_fallback'].includes(String(value.outcome)) ||
    !Number.isInteger(value.attempts) ||
    Number(value.attempts) < 0 ||
    !Number.isInteger(value.retryCount) ||
    Number(value.retryCount) < 0 ||
    Number(value.retryCount) > Math.max(0, Number(value.attempts) - 1) ||
    !isStringArray(value.sourceQuestionIds) ||
    value.sourceQuestionIds.length !== questionIds.length ||
    [...value.sourceQuestionIds].sort().some(
      (questionId, index) => questionId !== [...questionIds].sort()[index],
    )
  ) {
    return false;
  }

  return value.outcome !== 'llm' || Number(value.attempts) > 0;
}

const SURVEY_DEFINITION_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function isValidDynamicQuestionMetric(value: unknown): value is StoneMetric {
  return (
    isRecord(value) &&
    typeof value.questionId === 'string' &&
    value.questionId.trim().length > 0 &&
    typeof value.label === 'string' &&
    containsOnlyHebrewUserText(value.label) &&
    typeof value.value === 'string' &&
    containsOnlyHebrewUserText(value.value) &&
    typeof value.averageScore === 'number' &&
    Number.isFinite(value.averageScore) &&
    value.averageScore >= 0 &&
    value.averageScore <= 100 &&
    Number.isInteger(value.responseCount) &&
    Number(value.responseCount) > 0 &&
    (value.trend === undefined ||
      (typeof value.trend === 'string' &&
        containsOnlyHebrewUserText(value.trend)))
  );
}

function isValidV3GenerationProvenance(
  value: unknown,
  metricQuestionIds: string[],
  surveyDefinitionHash: string,
): value is StoneGenerationProvenance {
  if (!isRecord(value)) return false;

  const sortedMetricIds = [...metricQuestionIds].sort();
  return (
    ['llm', 'deterministic_fallback'].includes(String(value.outcome)) &&
    Number.isInteger(value.attempts) &&
    Number(value.attempts) >= 0 &&
    Number.isInteger(value.retryCount) &&
    Number(value.retryCount) >= 0 &&
    Number(value.retryCount) <= Math.max(0, Number(value.attempts) - 1) &&
    isStringArray(value.sourceQuestionIds) &&
    value.sourceQuestionIds.length === sortedMetricIds.length &&
    new Set(value.sourceQuestionIds).size === sortedMetricIds.length &&
    [...value.sourceQuestionIds]
      .sort()
      .every((questionId, index) => questionId === sortedMetricIds[index]) &&
    value.surveyDefinitionHash === surveyDefinitionHash &&
    (value.backgroundContextIncluded === undefined ||
      typeof value.backgroundContextIncluded === 'boolean') &&
    (value.outcome !== 'llm' || Number(value.attempts) > 0)
  );
}

function isValidV2Stone(
  value: unknown,
  dimensionId: WellbeingDimensionId,
): value is StoneDetail {
  if (!hasValidStoneShape(value, dimensionId)) {
    return false;
  }

  const status = value.status as WellbeingStatus;
  const expectedQuestions = canonicalQuestionsForDimension(dimensionId);
  const interventions = value.recommendedInterventions as unknown[];
  const metrics = value.metrics as unknown[];
  return (
    value.dimensionNameHebrew ===
      AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId] &&
    statusForScore(value.score as number) === status &&
    containsOnlyHebrewUserText(value.psychologicalInterpretation as string) &&
    hasExactlyTwoCompleteSentences(
      value.psychologicalInterpretation as string,
    ) &&
    interventions.every((intervention) =>
      isValidV2Intervention(intervention, dimensionId, status),
    ) &&
    metrics.length === expectedQuestions.length &&
    expectedQuestions.every((question) =>
      metrics.some((metric) => isValidQuestionMetric(metric, question)),
    ) &&
    isValidGenerationProvenance(value.generationProvenance, dimensionId)
  );
}

function isValidV3Stone(
  value: unknown,
  dimensionId: WellbeingDimensionId,
  surveyDefinitionHash: string,
): value is StoneDetail {
  if (!hasValidStoneShape(value, dimensionId)) {
    return false;
  }

  const status = value.status as WellbeingStatus;
  const interventions = value.recommendedInterventions as unknown[];
  const metrics = value.metrics as unknown[];
  if (
    metrics.length < 1 ||
    !metrics.every(isValidDynamicQuestionMetric)
  ) {
    return false;
  }

  const metricQuestionIds = metrics.map(
    (metric) => (metric as StoneMetric).questionId!,
  );
  return (
    new Set(metricQuestionIds).size === metricQuestionIds.length &&
    value.dimensionNameHebrew ===
      AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId] &&
    statusForScore(value.score as number) === status &&
    containsOnlyHebrewUserText(value.psychologicalInterpretation as string) &&
    hasExactlyTwoCompleteSentences(
      value.psychologicalInterpretation as string,
    ) &&
    interventions.every((intervention) =>
      isValidV2Intervention(intervention, dimensionId, status),
    ) &&
    isValidV3GenerationProvenance(
      value.generationProvenance,
      metricQuestionIds,
      surveyDefinitionHash,
    )
  );
}

function validateStatusFields(
  payload: Record<string, unknown>,
): StoneMapValidationResult | null {
  if (
    typeof payload.isLocked !== 'boolean' ||
    !['success', 'locked_error', 'validation_failed'].includes(
      String(payload.status),
    )
  ) {
    return { ok: false, error: 'Stone Map status fields are invalid.' };
  }

  if (payload.status !== 'success') {
    if (!payload.isLocked && payload.status === 'locked_error') {
      return {
        ok: false,
        error: 'locked_error payloads must set isLocked to true.',
      };
    }

    if (
      [
        AI_ANALYTICS_CONTRACT_VERSION,
        AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
        AI_ANALYTICS_V4_CONTRACT_VERSION,
      ].includes(String(payload.contractVersion)) &&
      (payload.stones !== undefined ||
        payload.overallPsychologicalSummary !== undefined)
    ) {
      return {
        ok: false,
        error: 'Non-success semantic payloads must not expose detailed results.',
      };
    }

    return { ok: true, value: payload as unknown as StoneMapResult };
  }

  if (payload.isLocked) {
    return {
      ok: false,
      error: 'Successful Stone Map payloads cannot be privacy locked.',
    };
  }

  return null;
}

export function validateStoneMapResult(
  payload: unknown,
  expectedRoundId: string,
): StoneMapValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: 'Stone Map payload must be a JSON object.' };
  }

  if (
    !AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS.includes(
      payload.contractVersion as AiAnalyticsContractVersion,
    )
  ) {
    return {
      ok: false,
      error: `contractVersion must be one of ${AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS.join(', ')}.`,
    };
  }

  if (payload.roundId !== expectedRoundId) {
    return {
      ok: false,
      error: `Payload roundId must match route roundId "${expectedRoundId}".`,
    };
  }

  if (
    [AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION, AI_ANALYTICS_V4_CONTRACT_VERSION].includes(
      String(payload.contractVersion),
    ) &&
    (typeof payload.surveyDefinitionHash !== 'string' ||
      !SURVEY_DEFINITION_HASH_PATTERN.test(payload.surveyDefinitionHash))
  ) {
    return {
      ok: false,
      error: 'The 3.0/4.0 payload requires a valid surveyDefinitionHash.',
    };
  }

  const statusValidation = validateStatusFields(payload);
  if (statusValidation) return statusValidation;

  if (
    typeof payload.processedAt !== 'string' ||
    Number.isNaN(Date.parse(payload.processedAt)) ||
    typeof payload.overallPsychologicalSummary !== 'string' ||
    !isRecord(payload.stones)
  ) {
    return {
      ok: false,
      error: 'Successful Stone Map payload metadata is invalid.',
    };
  }

  if (
    [
      AI_ANALYTICS_CONTRACT_VERSION,
      AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
      AI_ANALYTICS_V4_CONTRACT_VERSION,
    ].includes(String(payload.contractVersion)) &&
    !containsOnlyHebrewUserText(payload.overallPsychologicalSummary)
  ) {
    return {
      ok: false,
      error: 'The semantic round summary must contain Hebrew user-facing text.',
    };
  }

  const actualDimensionIds = Object.keys(payload.stones).sort();
  const expectedDimensionIds = [...AI_ANALYTICS_DIMENSION_IDS].sort();
  if (
    actualDimensionIds.length !== expectedDimensionIds.length ||
    actualDimensionIds.some(
      (dimensionId, index) => dimensionId !== expectedDimensionIds[index],
    )
  ) {
    return {
      ok: false,
      error: 'Stone Map must contain exactly the eight canonical dimensions.',
    };
  }

  for (const dimensionId of AI_ANALYTICS_DIMENSION_IDS) {
    const isValidStone =
      payload.contractVersion === AI_ANALYTICS_CONTRACT_VERSION
        ? isValidV2Stone(payload.stones[dimensionId], dimensionId)
        : [AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION, AI_ANALYTICS_V4_CONTRACT_VERSION].includes(
            String(payload.contractVersion),
          )
          ? isValidV3Stone(
              payload.stones[dimensionId],
              dimensionId,
              payload.surveyDefinitionHash as string,
            )
          : isValidLegacyStone(payload.stones[dimensionId], dimensionId);
    if (!isValidStone) {
      return {
        ok: false,
        error: `Stone "${dimensionId}" does not match AI analytics contract ${payload.contractVersion}.`,
      };
    }
  }

  return { ok: true, value: payload as unknown as StoneMapResult };
}
