"use client";

import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import { getDashboardMetricsActions, navigationLabels } from "@/lib/navigation";
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

export function DashboardMetricsPage({ dimension }: { dimension: WellbeingDimension }) {
  const metrics = getHighlightedMetrics(dimension).reverse();
  const dimensionSurface = getDimensionSurface(dimension);

  return (
    <div className="dashboard-mock-page dashboard-metrics-screen">
      <DashboardHeading title={`${navigationLabels.highlightedMetrics} | ${dimension.conceptLabel}`} />
      <DimensionIdentityChip dimension={dimension} />

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

      <DashboardCtaRow actions={getDashboardMetricsActions(dimension.id)} />
    </div>
  );
}
