"use client";

import type { DimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import { getDimensionSurface } from "@/lib/dashboard/dimension-presentation";
import {
  getDashboardStone,
  type DashboardStone,
} from "@/lib/dashboard/dashboard-insights";
import { getDimensionActionPresentation } from "@/lib/ai-insights-view-model";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import { getDashboardMetricsActions, navigationLabels } from "@/lib/navigation";
import { DashboardAiInsightsState } from "./dashboard-ai-insights-state";
import { DashboardCtaRow } from "./dashboard-cta-row";
import { DashboardHeading } from "./dashboard-heading";
import { DimensionIdentityChip } from "./dimension-identity-chip";
import { MetricBlob } from "./metric-blob";

export function getDisplayedMetrics(stone: DashboardStone) {
  return stone.metrics;
}

export function DashboardMetricsPage({
  dimension,
  roundId,
  organizationName,
  roundTitle,
}: {
  dimension: DimensionPresentation;
  roundId: string;
  organizationName: string;
  roundTitle: string;
}) {
  const { state, reload } = useAiInsights(roundId);
  const stone =
    state.status === "ready"
      ? getDashboardStone(state.value, dimension.id)
      : undefined;

  if (state.status !== "ready") {
    return (
      <div className="dashboard-mock-page dashboard-metrics-screen">
        <DashboardHeading
          title={`${navigationLabels.highlightedMetrics} | ${dimension.conceptLabel}`}
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        <DashboardAiInsightsState state={state} onRetry={reload} roundId={roundId} />
        <DashboardCtaRow
          actions={getDashboardMetricsActions(dimension.id)}
        />
      </div>
    );
  }

  if (!stone) {
    return (
      <div className="dashboard-mock-page dashboard-metrics-screen">
        <DashboardHeading
          title={`${navigationLabels.highlightedMetrics} | ${dimension.conceptLabel}`}
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        <DashboardAiInsightsState
          state={{ status: "error", error: "Missing dimension insight." }}
          onRetry={reload}
          roundId={roundId}
        />
      </div>
    );
  }

  return (
    <DashboardMetricsStage
      dimension={dimension}
      stone={stone}
      organizationName={organizationName}
      roundTitle={roundTitle}
    />
  );
}

/**
 * The screen once the analysis is in hand. Split from the state machine above
 * so the DTO path can be rendered and asserted without a fetch.
 */
export function DashboardMetricsStage({
  dimension,
  stone,
  organizationName,
  roundTitle,
}: {
  dimension: DimensionPresentation;
  stone: DashboardStone;
  organizationName: string;
  roundTitle: string;
}) {
  const metrics = getDisplayedMetrics(stone);
  const actionPresentation = getDimensionActionPresentation(stone.status);
  const actions = getDashboardMetricsActions(dimension.id).map((action) =>
    action.id === "dimensionRecommendations"
      ? { ...action, label: actionPresentation.actionsTitle }
      : action,
  );
  const dimensionSurface = getDimensionSurface(stone.status);

  return (
    <div className="dashboard-mock-page dashboard-metrics-screen">
      <DashboardHeading
        title={`${navigationLabels.highlightedMetrics} | ${dimension.conceptLabel}`}
        organizationName={organizationName}
        roundTitle={roundTitle}
      />
      <DimensionIdentityChip dimension={dimension} status={stone.status} />

      <section className="dashboard-metrics-stage" aria-label={`${navigationLabels.highlightedMetrics} עבור ${dimension.conceptLabel}`}>
        {metrics.map((metric, index) => (
          <MetricBlob
            key={`${metric.label}-${metric.value}`}
            metric={metric}
            color={dimensionSurface}
            emphasis={index === 0 ? "primary" : "secondary"}
          />
        ))}
      </section>

      <DashboardCtaRow
        actions={actions}
      />
    </div>
  );
}
