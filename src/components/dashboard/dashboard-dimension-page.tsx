"use client";

import { useBlobFit } from "@/lib/hooks/use-blob-fit";
import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import {
  applyStoneInsightToDimension,
  getStoneInsight,
} from "@/lib/ai-insights-view-model";
import { useDashboardRoundId } from "@/lib/hooks/use-dashboard-round-id";
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
  const resolvedRoundId = useDashboardRoundId(roundId);
  const { state, reload } = useAiInsights(resolvedRoundId);
  const stone =
    state.status === "ready"
      ? getStoneInsight(state.value, dimension.id)
      : undefined;
  const displayDimension = stone
    ? applyStoneInsightToDimension(
        dimension,
        stone,
        state.status === "ready"
          ? state.value.overallPsychologicalSummary
          : undefined,
      )
    : dimension;
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
          roundId={resolvedRoundId}
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
        title={`תמונת מצב | ${displayDimension.conceptLabel}`}
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
        roundId={resolvedRoundId}
      />
    </div>
  );
}
