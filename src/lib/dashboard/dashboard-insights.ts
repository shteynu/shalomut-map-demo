import type {
  WellbeingDimensionId,
  WellbeingStatus,
} from '@/lib/shalomut-source';

/**
 * What the Dashboard renders, named once.
 *
 * This is a presentation contract, not a wire contract: nothing here carries a
 * contract version, an optional field that only some version fills, or a name
 * borrowed from the payload. A new AI contract changes the mapper in
 * `ai-insights-view-model.ts` and stops there — before this type existed, the
 * components held `StoneMapResult` itself and read `overallPsychologicalSummary`
 * on screen.
 */
export interface DashboardMetric {
  label: string;
  /** Empty for a narrative metric, which has no number to show. */
  value: string;
  helper: string;
  highlightText?: string;
  /** Qualitative copy that must render without numeric evidence beside it. */
  narrativeOnly?: boolean;
  /**
   * How the answers to this question split. Present only when the question
   * cleared the privacy threshold; the counts are always spelled out in
   * `helper`, so the bar drawn from them adds no information of its own.
   */
  distribution?: {
    green: number;
    yellow: number;
    red: number;
  };
}

export interface DashboardRecommendation {
  title: string;
  body: string;
}

export interface DashboardStone {
  dimensionId: WellbeingDimensionId;
  score: number;
  status: WellbeingStatus;
  summary: string[];
  /**
   * True when the round finished but the provider never wrote this dimension's
   * interpretation. An empty `summary` alone cannot say that: it is also what a
   * dimension looks like before any analysis exists, and the two need different
   * words on the screen.
   */
  interpretationUnavailable: boolean;
  /**
   * True when this dimension's paragraphs were written by the service from the
   * aggregates rather than by the model. The copy is real and says nothing the
   * numbers do not, but a manager reading a red dimension is entitled to know
   * that no model looked at it — otherwise a round the provider never answered
   * is indistinguishable on screen from one it did.
   */
  summaryIsDeterministic: boolean;
  metrics: DashboardMetric[];
  recommendations: DashboardRecommendation[];
}

export interface DashboardInsightsDto {
  roundId: string;
  /** Empty when the round carries no organization-level summary. */
  overallSummary: string;
  stones: Partial<Record<WellbeingDimensionId, DashboardStone>>;
}

export function getDashboardStone(
  insights: DashboardInsightsDto,
  dimensionId: string,
): DashboardStone | undefined {
  return insights.stones[dimensionId as WellbeingDimensionId];
}
