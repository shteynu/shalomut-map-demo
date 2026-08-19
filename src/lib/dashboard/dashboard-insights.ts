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
  /**
   * The catalog entry this advice came from — an ISO 45003 clause, an OECD
   * TALIS guideline — as the AI payload names it. Empty when the payload
   * carried none, which is the only case a screen may show nothing rather than
   * an attribution.
   */
  source: string;
  /**
   * `false` on a version that never adapts wording at all, same as the other
   * provenance flags — the screen only ever adds a note, never claims
   * authorship it cannot back.
   */
  interventionIsDeterministic: boolean;
}

/**
 * The two ways a dimension ends up with no words, which are not the same news:
 * one is a service that did not answer and probably will, the other is copy
 * this product wrote, refused and threw away rather than show.
 */
export type InterpretationGapReason =
  | 'provider_unavailable'
  | 'validation_rejected';

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
   * Why, when the round said. Absent on rounds analysed before the service
   * recorded a reason, and the screens fall back to saying only that the
   * interpretation is missing rather than guessing which cause it was.
   */
  interpretationUnavailableReason?: InterpretationGapReason;
  /**
   * True when this dimension's paragraphs were written by the service from the
   * aggregates rather than by the model. The copy is real and says nothing the
   * numbers do not, but a manager reading a red dimension is entitled to know
   * that no model looked at it — otherwise a round the provider never answered
   * is indistinguishable on screen from one it did.
   */
  summaryIsDeterministic: boolean;
  /**
   * The same fact for the metric narratives, which fall back on their own.
   * `summaryIsDeterministic` says nothing about them: the two calls succeed and
   * fail independently, so a stone can open with the model's three paragraphs
   * and then read every question in words the service derived.
   *
   * False on a round analysed before the service recorded this, which is the
   * one case where false does not mean "a model wrote them". The screen
   * therefore only ever adds a note; it never claims authorship.
   */
  metricNarrativesAreDeterministic: boolean;
  metrics: DashboardMetric[];
  recommendations: DashboardRecommendation[];
}

export interface DashboardInsightsDto {
  roundId: string;
  /** Empty when the round carries no organization-level summary. */
  overallSummary: string;
  /**
   * `false` on a version that never asks the model for this sentence and on a
   * round analysed before the field existed — the round-level sibling of
   * every stone's own `summaryIsDeterministic`. The screen only ever adds a
   * note; it never claims authorship.
   */
  overallSummaryIsDeterministic: boolean;
  stones: Partial<Record<WellbeingDimensionId, DashboardStone>>;
  /**
   * The dimensions this round has no interpretation for, in canonical order.
   * Empty for a whole map. A manager who never opens the one dimension that is
   * missing would otherwise read the map as complete.
   */
  dimensionsWithoutInterpretation: WellbeingDimensionId[];
  /**
   * The same gaps grouped by cause, so the map can say why without the caller
   * walking the stones. A dimension whose round recorded no reason lands in
   * `unstated`.
   */
  gapsByReason: {
    provider_unavailable: WellbeingDimensionId[];
    validation_rejected: WellbeingDimensionId[];
    unstated: WellbeingDimensionId[];
  };
  /**
   * The dimensions whose summary paragraphs the service composed from the
   * round's own numbers rather than the model writing them, in canonical
   * order. Disjoint from every list above: a stone's provenance outcome is one
   * value, so a dimension is either missing its words or has words nobody's
   * model wrote — never both.
   *
   * Separate from `gapsByReason` because it is a different fact. Those
   * dimensions have no interpretation; these have one, and it is honest about
   * what it is. Contract 6.0 does not raise per dimension, so this — not
   * `unavailable` — is the shape a silent provider actually takes on the
   * deployed contract, and the map page had no way to say so.
   *
   * Only the summary. Metric narratives fall back separately and are disclosed
   * on the screen that shows them, deliberately: a manager who read a real
   * interpretation has no reason to suspect the readings underneath it.
   */
  dimensionsWithDeterministicSummary: WellbeingDimensionId[];
}

export function getDashboardStone(
  insights: DashboardInsightsDto,
  dimensionId: string,
): DashboardStone | undefined {
  return insights.stones[dimensionId as WellbeingDimensionId];
}
