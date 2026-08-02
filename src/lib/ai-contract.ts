import legacyContractManifest from '../../contracts/ai-analytics-v1.json';
import contractManifest from '../../contracts/ai-analytics-v2.json';
import dynamicContractManifest from '../../contracts/ai-analytics-v3.json';
import v4ContractManifest from '../../contracts/ai-analytics-v4.json';
import v5ContractManifest from '../../contracts/ai-analytics-v5.json';
import v6ContractManifest from '../../contracts/ai-analytics-v6.json';
import { getCapabilities, type ContractCapabilities } from './contract-registry';
import type {
  WellbeingDimensionId,
  WellbeingStatus,
} from './shalomut-source';

export const AI_ANALYTICS_V1_CONTRACT_VERSION = legacyContractManifest.version;
export const AI_ANALYTICS_CONTRACT_VERSION = contractManifest.version;
export const AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION =
  dynamicContractManifest.version;
export const AI_ANALYTICS_V4_CONTRACT_VERSION = v4ContractManifest.version;
export const AI_ANALYTICS_V5_CONTRACT_VERSION = v5ContractManifest.version;
export const AI_ANALYTICS_V6_CONTRACT_VERSION = v6ContractManifest.version;

export const AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS = Object.freeze([
  AI_ANALYTICS_V1_CONTRACT_VERSION,
  AI_ANALYTICS_CONTRACT_VERSION,
  AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
  AI_ANALYTICS_V4_CONTRACT_VERSION,
  AI_ANALYTICS_V5_CONTRACT_VERSION,
  AI_ANALYTICS_V6_CONTRACT_VERSION,
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
  /** 5.0 only: the input distribution echoed back for Core to verify. */
  scoreDistribution?: ScoreDistribution;
}

export interface StoneMetricV6 extends StoneMetric {
  /** Qualitative Hebrew copy shown instead of Core-owned numeric evidence. */
  insightText: string;
}

export interface StoneIntervention {
  id: string;
  dimensionId: WellbeingDimensionId;
  status?: WellbeingStatus;
  source: string;
  title: string;
  summary: string;
  actionable_steps: string[];
  /** 5.0 only: whether this copy was rewritten for the school or is catalog text. */
  adaptationOutcome?: 'llm' | 'deterministic_fallback';
}

export interface ScoreDistribution {
  green: number;
  yellow: number;
  red: number;
}

export interface StoneGenerationProvenance {
  /**
   * `unavailable` is 5.0 only: the provider answered nothing for this one
   * dimension and the stone carries no interpretation. It is not a third kind
   * of copy — it is the absence of copy, said out loud. A stone that claimed
   * `deterministic_fallback` with heuristic text would be the fallback posing
   * as analysis, which the product does not do.
   */
  outcome: 'llm' | 'deterministic_fallback' | 'unavailable';
  attempts: number;
  retryCount: number;
  sourceQuestionIds: string[];
  surveyDefinitionHash?: string;
  backgroundContextIncluded?: boolean;
  distributionIncluded?: boolean;
  crossDimensionContextIncluded?: boolean;
}

export interface StoneDetail {
  dimensionId: WellbeingDimensionId;
  dimensionNameHebrew: string;
  status: WellbeingStatus;
  score: number;
  /** Empty exactly when `generationProvenance.outcome` is `unavailable`. */
  psychologicalInterpretation: string;
  recommendedInterventions: StoneIntervention[];
  metrics: StoneMetric[];
  generationProvenance?: StoneGenerationProvenance;
}

export interface StoneDetailV6 {
  dimensionId: WellbeingDimensionId;
  dimensionNameHebrew: string;
  status: WellbeingStatus;
  score: number;
  summary: [string, string, string];
  recommendedInterventions: [
    StoneIntervention,
    StoneIntervention,
    StoneIntervention,
    StoneIntervention,
    StoneIntervention,
  ];
  metrics: StoneMetricV6[];
  generationProvenance: StoneGenerationProvenance;
}

export type AnyStoneDetail = StoneDetail | StoneDetailV6;

export interface StoneMapResult {
  contractVersion: AiAnalyticsKnownContractVersion;
  roundId: string;
  processedAt?: string;
  surveyDefinitionHash?: string;
  isLocked: boolean;
  status: 'success' | 'locked_error' | 'validation_failed';
  errorMessage?: string;
  overallPsychologicalSummary?: string;
  stones?: Record<WellbeingDimensionId, AnyStoneDetail>;
  /**
   * 5.0 only: the dimensions whose interpretation the provider never produced.
   * Derivable by walking the stones, and stated here anyway so a reader — a
   * log, a support question, the screens' banner — can see that the map is
   * partial without inspecting eight provenance blocks.
   */
  dimensionsWithoutInterpretation?: WellbeingDimensionId[];
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

/**
 * The Hebrew block, plus the presentation forms a model may reach for instead
 * of the base letter with its point. Both are Hebrew to a reader, so both
 * count as Hebrew here \u2014 the same range the Python validator uses.
 */
const HEBREW_CHARACTER_PATTERN = /[\u0590-\u05ff\ufb1d-\ufb4f]/u;

/**
 * True when every letter in the copy is Hebrew and at least one is.
 *
 * The check used to name the one script it refused \u2014 Latin \u2014 so a whole
 * sentence in Cyrillic or Arabic passed as long as one Hebrew letter stood
 * somewhere in it. Python tightened the same rule on 2026-07-30 and Core did
 * not, which left the callback accepting copy the service that generates it
 * would refuse. `contracts/fixtures/hebrew_text_corpus.json` now holds the
 * cases both runtimes answer identically.
 *
 * Digits, punctuation and Hebrew points are not letters and are unaffected;
 * the per-version rules that forbid numbers in narrative copy are separate.
 */
export function isHebrewOnlyUserText(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || !HEBREW_CHARACTER_PATTERN.test(normalized)) return false;

  for (const character of normalized) {
    if (/\p{L}/u.test(character) && !HEBREW_CHARACTER_PATTERN.test(character)) {
      return false;
    }
  }

  return true;
}

const containsOnlyHebrewUserText = isHebrewOnlyUserText;

function hasExactlyTwoCompleteSentences(value: string): boolean {
  const normalized = value.trim();
  const sentences = normalized.match(/[^.!?؟]+[.!?؟]/gu) ?? [];
  return (
    sentences.length === 2 &&
    sentences.join('').replace(/\s/gu, '') === normalized.replace(/\s/gu, '')
  );
}

function hasTwoToFiveCompleteSentences(value: string): boolean {
  const normalized = value.trim();
  const sentences = normalized.match(/[^.!?؟]+[.!?؟]/gu) ?? [];
  return (
    sentences.length >= 2 &&
    sentences.length <= 5 &&
    sentences.join('').replace(/\s/gu, '') === normalized.replace(/\s/gu, '')
  );
}

function hasTwoToFourCompleteSentences(value: string): boolean {
  const normalized = value.trim();
  const sentences = normalized.match(/[^.!?؟]+[.!?؟]/gu) ?? [];
  return (
    sentences.length >= 2 &&
    sentences.length <= 4 &&
    sentences.join('').replace(/\s/gu, '') === normalized.replace(/\s/gu, '')
  );
}

function hasExactlyThreeHebrewParagraphs(
  value: unknown,
): value is [string, string, string] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (paragraph) =>
        typeof paragraph === 'string' &&
        paragraph.trim().length > 0 &&
        containsOnlyHebrewUserText(paragraph) &&
        !/[\p{Number}%٪]/u.test(paragraph) &&
        !/\p{Script=Latin}/u.test(paragraph) &&
        /[.!?؟]$/u.test(paragraph.trim()),
    )
  );
}

function isQualitativeNarrative(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const length = Array.from(value.trim()).length;
  return (
    length >= 300 &&
    length <= 500 &&
    containsOnlyHebrewUserText(value) &&
    !/[\p{Number}%٪]/u.test(value) &&
    !/\p{Script=Latin}/u.test(value)
  );
}

export function isValidScoreDistribution(
  dist: unknown,
  responseCount: number,
): dist is ScoreDistribution {
  return (
    isRecord(dist) &&
    Number.isInteger(dist.green) &&
    Number(dist.green) >= 0 &&
    Number.isInteger(dist.yellow) &&
    Number(dist.yellow) >= 0 &&
    Number.isInteger(dist.red) &&
    Number(dist.red) >= 0 &&
    Number(dist.green) + Number(dist.yellow) + Number(dist.red) === responseCount
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

/**
 * 5.0 rewrites the catalog copy for the school, so every intervention has to
 * say which it is. The structural validators above accept unknown fields, so
 * an adaptation outcome that was missing, misspelled or invented would pass
 * unnoticed and a reader could not tell a rewrite from catalog text.
 */
function isValidV5Intervention(
  value: unknown,
  dimensionId: WellbeingDimensionId,
  status: WellbeingStatus,
): value is StoneIntervention {
  if (!isValidV2Intervention(value, dimensionId, status)) {
    return false;
  }
  return ['llm', 'deterministic_fallback'].includes(
    String(value.adaptationOutcome),
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

/**
 * 5.0 metrics carry the distribution the AI service was given, so Core can
 * check it against the answers instead of trusting it. The structural
 * validators accept unknown fields, so without this the service could return
 * any three numbers — or none — and nothing would notice.
 */
function isValidV5QuestionMetric(value: unknown): value is StoneMetric {
  if (!isValidDynamicQuestionMetric(value)) {
    return false;
  }
  return isValidScoreDistribution(
    value.scoreDistribution,
    Number(value.responseCount),
  );
}

function isValidV6QuestionMetric(value: unknown): value is StoneMetricV6 {
  return (
    isValidV5QuestionMetric(value) &&
    isQualitativeNarrative(
      (value as unknown as Record<string, unknown>).insightText,
    )
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

function isValidV5GenerationProvenance(
  value: unknown,
  metricQuestionIds: string[],
  surveyDefinitionHash: string,
): value is StoneGenerationProvenance {
  if (!isRecord(value)) return false;

  const sortedMetricIds = [...metricQuestionIds].sort();
  return (
    // `unavailable` is accepted here and nowhere below 5.0: the older
    // contracts are closed boundaries, and a stone with no interpretation is
    // not a shape they ever described.
    ['llm', 'deterministic_fallback', 'unavailable'].includes(
      String(value.outcome),
    ) &&
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
    (value.distributionIncluded === undefined ||
      typeof value.distributionIncluded === 'boolean') &&
    (value.crossDimensionContextIncluded === undefined ||
      typeof value.crossDimensionContextIncluded === 'boolean') &&
    (value.outcome !== 'llm' || Number(value.attempts) > 0)
  );
}

function isValidV5Stone(
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
  if (metrics.length < 1 || !metrics.every(isValidV5QuestionMetric)) {
    return false;
  }

  const metricQuestionIds = metrics.map(
    (metric) => (metric as StoneMetric).questionId!,
  );
  const provenance = value.generationProvenance;
  const unavailable =
    isRecord(provenance) && provenance.outcome === 'unavailable';
  const interpretation = value.psychologicalInterpretation as string;
  // A stone whose interpretation the provider never produced carries no
  // interpretation at all. Empty is the only text an `unavailable` stone may
  // hold, and any text is the only thing the other outcomes may hold: the two
  // rules together are what stop a heuristic paragraph from arriving under a
  // label that says nothing was generated.
  const interpretationValid = unavailable
    ? interpretation === ''
    : containsOnlyHebrewUserText(interpretation) &&
      hasTwoToFiveCompleteSentences(interpretation);

  return (
    new Set(metricQuestionIds).size === metricQuestionIds.length &&
    value.dimensionNameHebrew ===
      AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId] &&
    statusForScore(value.score as number) === status &&
    interpretationValid &&
    interventions.every((intervention) =>
      isValidV5Intervention(intervention, dimensionId, status),
    ) &&
    isValidV5GenerationProvenance(
      provenance,
      metricQuestionIds,
      surveyDefinitionHash,
    )
  );
}

function isValidV6Stone(
  value: unknown,
  dimensionId: WellbeingDimensionId,
  surveyDefinitionHash: string,
): value is StoneDetailV6 {
  if (
    !isRecord(value) ||
    value.dimensionId !== dimensionId ||
    value.dimensionNameHebrew !==
      AI_ANALYTICS_DIMENSION_NAMES_HEBREW[dimensionId] ||
    !WELLBEING_STATUSES.has(value.status as WellbeingStatus) ||
    typeof value.score !== 'number' ||
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    value.score > 100 ||
    statusForScore(value.score) !== value.status ||
    value.psychologicalInterpretation !== undefined ||
    !hasExactlyThreeHebrewParagraphs(value.summary) ||
    !Array.isArray(value.metrics) ||
    value.metrics.length < 1 ||
    !value.metrics.every(isValidV6QuestionMetric) ||
    !Array.isArray(value.recommendedInterventions) ||
    value.recommendedInterventions.length !== 5
  ) {
    return false;
  }

  const status = value.status as WellbeingStatus;
  const metrics = value.metrics as StoneMetricV6[];
  const metricQuestionIds = metrics.map((metric) => metric.questionId!);
  const interventions = value.recommendedInterventions as StoneIntervention[];
  const provenance = value.generationProvenance;

  return (
    new Set(metricQuestionIds).size === metricQuestionIds.length &&
    new Set(interventions.map((intervention) => intervention.id)).size === 5 &&
    interventions.every(
      (intervention) =>
        isValidV5Intervention(intervention, dimensionId, status) &&
        isQualitativeNarrative(intervention.summary),
    ) &&
    isValidV5GenerationProvenance(
      provenance,
      metricQuestionIds,
      surveyDefinitionHash,
    ) &&
    isRecord(provenance) &&
    provenance.outcome !== 'unavailable'
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

    const caps = getCapabilities(String(payload.contractVersion));
    if (
      caps.isSemanticContract &&
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

/**
 * The partial map has to be partial in one place only.
 *
 * `dimensionsWithoutInterpretation` is a convenience for a reader, and a
 * convenience that can disagree with the stones is worse than no convenience:
 * a banner saying two dimensions are missing over a map missing three is how
 * a manager stops trusting the screen. The list is therefore required to be
 * exactly the set of `unavailable` stones. A round where every dimension
 * failed is not a partial map — it is a failed round, and the service reports
 * it as `provider_unavailable` instead of arriving here empty.
 */
function validateInterpretationGaps(
  payload: Record<string, unknown>,
): StoneMapValidationResult | null {
  const stones = payload.stones as Record<string, StoneDetail>;
  const declared = payload.dimensionsWithoutInterpretation;

  const actual = AI_ANALYTICS_DIMENSION_IDS.filter(
    (dimensionId) =>
      stones[dimensionId]?.generationProvenance?.outcome === 'unavailable',
  );

  if (declared === undefined) {
    return actual.length === 0
      ? null
      : {
          ok: false,
          error:
            'Stones without an interpretation must be listed in dimensionsWithoutInterpretation.',
        };
  }

  const caps = getCapabilities(String(payload.contractVersion));
  if (!caps.supportsPartialMaps) {
    return {
      ok: false,
      error:
        'dimensionsWithoutInterpretation is only supported by contracts with partial maps.',
    };
  }

  if (
    !isStringArray(declared) ||
    declared.length !== actual.length ||
    [...declared].sort().some((id, index) => id !== [...actual].sort()[index])
  ) {
    return {
      ok: false,
      error:
        'dimensionsWithoutInterpretation must list exactly the stones whose outcome is unavailable.',
    };
  }

  if (actual.length === AI_ANALYTICS_DIMENSION_IDS.length) {
    return {
      ok: false,
      error:
        'A round with no interpretation for any dimension is a failure, not a partial map.',
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

  const caps = getCapabilities(String(payload.contractVersion));
  if (
    caps.supportsDynamicQuestions &&
    (typeof payload.surveyDefinitionHash !== 'string' ||
      !SURVEY_DEFINITION_HASH_PATTERN.test(payload.surveyDefinitionHash))
  ) {
    return {
      ok: false,
      error: 'Dynamic analytics payloads require a valid surveyDefinitionHash.',
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
    caps.isSemanticContract &&
    !containsOnlyHebrewUserText(payload.overallPsychologicalSummary as string)
  ) {
    return {
      ok: false,
      error: 'The semantic round summary must contain Hebrew user-facing text.',
    };
  }

  if (
    caps.hasOverallSummarySentenceLimit &&
    !hasTwoToFourCompleteSentences(payload.overallPsychologicalSummary as string)
  ) {
    return {
      ok: false,
      error: 'The 5.0 overall psychological summary must have 2 to 4 complete sentences.',
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
    const isValidStone = !caps.isSemanticContract
      ? isValidLegacyStone(payload.stones[dimensionId], dimensionId)
      : caps.usesStructuredDimensionSummary
        ? isValidV6Stone(
            payload.stones[dimensionId],
            dimensionId,
            payload.surveyDefinitionHash as string,
          )
        : caps.supportsScoreDistribution
          ? isValidV5Stone(
              payload.stones[dimensionId],
              dimensionId,
              payload.surveyDefinitionHash as string,
            )
          : caps.supportsDynamicQuestions
            ? isValidV3Stone(
                payload.stones[dimensionId],
                dimensionId,
                payload.surveyDefinitionHash as string,
              )
            : isValidV2Stone(payload.stones[dimensionId], dimensionId);
    if (!isValidStone) {
      return {
        ok: false,
        error: `Stone "${dimensionId}" does not match AI analytics contract ${payload.contractVersion}.`,
      };
    }
  }

  const gapsError = validateInterpretationGaps(payload);
  if (gapsError) return gapsError;

  return { ok: true, value: payload as unknown as StoneMapResult };
}
