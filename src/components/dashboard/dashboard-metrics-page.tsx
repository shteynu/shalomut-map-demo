"use client";

import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import {
  applyStoneInsightToDimension,
  getStoneInsight,
} from "@/lib/ai-insights-view-model";
import { useDashboardRoundId } from "@/lib/hooks/use-dashboard-round-id";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import { getDashboardMetricsActions, navigationLabels } from "@/lib/navigation";
import { DashboardAiInsightsState } from "./dashboard-ai-insights-state";
import { DashboardCtaRow } from "./dashboard-cta-row";
import { DashboardHeading } from "./dashboard-heading";
import { DimensionIdentityChip } from "./dimension-identity-chip";
import { MetricBlob } from "./metric-blob";

function getHighlightedMetrics(dimension: WellbeingDimension) {
  const highlighted = dimension.metrics.filter((metric) => metric.highlightText);

  if (highlighted.length >= 2) {
    return highlighted.slice(0, 2);
  }

  const fallback = dimension.metrics.filter((metric) => !highlighted.includes(metric));
  return [...highlighted, ...fallback].slice(0, 2);
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
  const resolvedRoundId = useDashboardRoundId(roundId);
  const { state, reload } = useAiInsights(resolvedRoundId);
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
          roundId={resolvedRoundId}
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
    state.value.overallPsychologicalSummary,
  );
  const metrics = getHighlightedMetrics(displayDimension).reverse();
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
        actions={getDashboardMetricsActions(displayDimension.id)}
        roundId={resolvedRoundId}
      />
    </div>
  );
}
