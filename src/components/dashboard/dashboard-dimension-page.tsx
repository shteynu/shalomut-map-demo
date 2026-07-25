"use client";

import { useBlobFit } from "@/lib/hooks/use-blob-fit";
import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import {
  applyStoneInsightToDimension,
  getDimensionActionPresentation,
  getStoneInsight,
} from "@/lib/ai-insights-view-model";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import { getDashboardDetailActions } from "@/lib/navigation";
import { DashboardAiInsightsState } from "./dashboard-ai-insights-state";
import { DashboardCtaRow } from "./dashboard-cta-row";
import { DashboardHeading } from "./dashboard-heading";
import { DimensionIdentityChip } from "./dimension-identity-chip";

export function DashboardDimensionPage({
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
  const displayDimension = stone
    ? applyStoneInsightToDimension(dimension, stone)
    : dimension;
  const actionPresentation = getDimensionActionPresentation(
    displayDimension.status,
  );
  const dimensionSurface = getDimensionSurface(displayDimension);
  const { containerRef, contentRef } = useBlobFit(
    `${displayDimension.id}-${displayDimension.summary.join("|")}`,
  );

  if (state.status !== "ready") {
    return (
      <div className="dashboard-mock-page dashboard-detail-screen">
        <DashboardHeading
          title={`תמונת מצב | ${dimension.conceptLabel}`}
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        <DashboardAiInsightsState state={state} onRetry={reload} />
        <DashboardCtaRow
          actions={getDashboardDetailActions(dimension.id)}
        />
      </div>
    );
  }

  if (!stone) {
    return (
      <div className="dashboard-mock-page dashboard-detail-screen">
        <DashboardHeading
          title={`תמונת מצב | ${dimension.conceptLabel}`}
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

  return (
    <div className="dashboard-mock-page dashboard-detail-screen">
      <DashboardHeading
        title={`${actionPresentation.dimensionTitle} | ${displayDimension.conceptLabel}`}
        organizationName={organizationName}
        roundTitle={roundTitle}
      />
      <DimensionIdentityChip dimension={displayDimension} />

      <article
        ref={containerRef as any}
        className="dashboard-single-blob"
        style={{ backgroundColor: dimensionSurface, display: "grid" }}
      >
        <div ref={contentRef as any} className="dashboard-single-blob-copy">
          {displayDimension.summary.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>

      <DashboardCtaRow
        actions={getDashboardDetailActions(displayDimension.id)}
      />
    </div>
  );
}
