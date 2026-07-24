import contractManifest from '../../contracts/ai-analytics-v1.json';
import type {
  WellbeingDimensionId,
  WellbeingStatus,
} from './shalomut-source';

export const AI_ANALYTICS_CONTRACT_VERSION = contractManifest.version;

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

export interface StoneMetric {
  label: string;
  value: string;
  trend?: string;
}

export interface StoneIntervention {
  id: string;
  dimensionId: WellbeingDimensionId;
  source: string;
  title: string;
  summary: string;
  actionable_steps: string[];
}

export interface StoneDetail {
  dimensionId: WellbeingDimensionId;
  dimensionNameHebrew: string;
  status: WellbeingStatus;
  score: number;
  psychologicalInterpretation: string;
  recommendedInterventions: StoneIntervention[];
  metrics: StoneMetric[];
}

export interface StoneMapResult {
  contractVersion: string;
  roundId: string;
  processedAt?: string;
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

function isValidMetric(value: unknown): value is StoneMetric {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.value === 'string' &&
    (value.trend === undefined || typeof value.trend === 'string')
  );
}

function isValidIntervention(value: unknown): value is StoneIntervention {
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

function isValidStone(
  value: unknown,
  dimensionId: WellbeingDimensionId,
): value is StoneDetail {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.dimensionId === dimensionId &&
    typeof value.dimensionNameHebrew === 'string' &&
    WELLBEING_STATUSES.has(value.status as WellbeingStatus) &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score) &&
    value.score >= 0 &&
    value.score <= 100 &&
    typeof value.psychologicalInterpretation === 'string' &&
    Array.isArray(value.recommendedInterventions) &&
    value.recommendedInterventions.every(
      (intervention) =>
        isValidIntervention(intervention) &&
        intervention.dimensionId === dimensionId,
    ) &&
    Array.isArray(value.metrics) &&
    value.metrics.every(isValidMetric)
  );
}

export function validateStoneMapResult(
  payload: unknown,
  expectedRoundId: string,
): StoneMapValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, error: 'Stone Map payload must be a JSON object.' };
  }

  if (payload.contractVersion !== AI_ANALYTICS_CONTRACT_VERSION) {
    return {
      ok: false,
      error: `contractVersion must be ${AI_ANALYTICS_CONTRACT_VERSION}.`,
    };
  }

  if (payload.roundId !== expectedRoundId) {
    return {
      ok: false,
      error: `Payload roundId must match route roundId "${expectedRoundId}".`,
    };
  }

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

    return { ok: true, value: payload as unknown as StoneMapResult };
  }

  if (payload.isLocked) {
    return {
      ok: false,
      error: 'Successful Stone Map payloads cannot be privacy locked.',
    };
  }

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
    if (!isValidStone(payload.stones[dimensionId], dimensionId)) {
      return {
        ok: false,
        error: `Stone "${dimensionId}" does not match the AI analytics contract.`,
      };
    }
  }

  return { ok: true, value: payload as unknown as StoneMapResult };
}
