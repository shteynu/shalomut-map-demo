"use client";

import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import {
  applyStoneInsightToDimension,
  getDimensionActionPresentation,
  getStoneInsight,
} from "@/lib/ai-insights-view-model";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import { getDashboardMetricsActions, navigationLabels } from "@/lib/navigation";
import { DashboardAiInsightsState } from "./dashboard-ai-insights-state";
import { DashboardCtaRow } from "./dashboard-cta-row";
import { DashboardHeading } from "./dashboard-heading";
import { DimensionIdentityChip } from "./dimension-identity-chip";
import { MetricBlob } from "./metric-blob";

export function getDisplayedMetrics(dimension: WellbeingDimension) {
  return dimension.metrics;
}

export function DashboardMetricsPage({
  dimension,
  roundId,
  organizationName,
  roundTitle,
}: {
  dimension: WellbeingDimension;
  roundId: string;
  organizationName: string;
  roundTitle: string;
}) {
  const { state, reload } = useAiInsights(roundId);
  const stone =
    state.status === "ready"
      ? getStoneInsight(state.value, dimension.id)
      : undefined;

  if (state.status !== "ready") {
    return (
      <div className="dashboard-mock-page dashboard-metrics-screen">
        <DashboardHeading
          title={`${navigationLabels.highlightedMetrics} | ${dimension.conceptLabel}`}
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        <DashboardAiInsightsState state={state} onRetry={reload} />
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
        />
      </div>
    );
  }

  const displayDimension = applyStoneInsightToDimension(
    dimension,
    stone,
  );
  const metrics = getDisplayedMetrics(displayDimension);
  const actionPresentation = getDimensionActionPresentation(
    displayDimension.status,
  );
  const actions = getDashboardMetricsActions(displayDimension.id).map(
    (action) =>
      action.id === "dimensionRecommendations"
        ? { ...action, label: actionPresentation.actionsTitle }
        : action,
  );
  const dimensionSurface = getDimensionSurface(displayDimension);

  return (
    <div className="dashboard-mock-page dashboard-metrics-screen">
      <DashboardHeading
        title={`${navigationLabels.highlightedMetrics} | ${displayDimension.conceptLabel}`}
        organizationName={organizationName}
        roundTitle={roundTitle}
      />
      <DimensionIdentityChip dimension={displayDimension} />

      <section className="dashboard-metrics-stage" aria-label={`${navigationLabels.highlightedMetrics} עבור ${displayDimension.conceptLabel}`}>
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
