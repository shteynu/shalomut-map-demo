"use client";

import type { CSSProperties } from "react";
import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import { useBlobFit } from "@/lib/hooks/use-blob-fit";
import {
  applyStoneInsightToDimension,
  getDimensionActionPresentation,
  getStoneInsight,
} from "@/lib/ai-insights-view-model";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import { getDashboardRecommendationsActions, navigationLabels } from "@/lib/navigation";
import { DashboardAiInsightsState } from "./dashboard-ai-insights-state";
import { DashboardCtaRow } from "./dashboard-cta-row";
import { DashboardHeading } from "./dashboard-heading";
import { DimensionIdentityChip } from "./dimension-identity-chip";
import { RecommendationBlob } from "./recommendation-blob";

const recommendationBlobClasses = [
  "dashboard-recommendation-blob dashboard-recommendation-blob-top-left",
  "dashboard-recommendation-blob dashboard-recommendation-blob-top-right",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-left",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-center",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-right",
];

function getDisplayRecommendations(dimension: WellbeingDimension) {
  return dimension.recommendations;
}

function PreservationRecommendationBlob({
  recommendation,
  className,
  color,
  priority,
  featured,
  itemLabel,
}: {
  recommendation: { title: string; body: string };
  className: string;
  color: string;
  priority: number;
  featured: boolean;
  itemLabel: string;
}) {
  const { containerRef, contentRef } = useBlobFit(
    `${recommendation.title}-${recommendation.body}`,
  );

  return (
    <article
      ref={containerRef as any}
      className={`${className}${featured ? " is-featured" : ""}`}
      style={{ "--dimension-surface": color } as CSSProperties}
    >
      <div
        ref={contentRef as any}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}
      >
        <span className="dashboard-recommendation-priority">
          {itemLabel} {priority}
        </span>
        <h2>{recommendation.title}</h2>
        <p>{recommendation.body}</p>
      </div>
    </article>
  );
}

export function DashboardRecommendationsPage({
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
      <div className="dashboard-mock-page dashboard-recommendations-screen">
        <DashboardHeading
          title={`${navigationLabels.goals} | ${dimension.conceptLabel}`}
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        <DashboardAiInsightsState state={state} onRetry={reload} roundId={roundId} />
        <DashboardCtaRow
          center
          actions={getDashboardRecommendationsActions()}
        />
      </div>
    );
  }

  if (!stone) {
    return (
      <div className="dashboard-mock-page dashboard-recommendations-screen">
        <DashboardHeading
          title={`${navigationLabels.goals} | ${dimension.conceptLabel}`}
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

  const displayDimension = applyStoneInsightToDimension(
    dimension,
    stone,
  );
  const recommendations = getDisplayRecommendations(displayDimension);
  const isFiveItemLayout = recommendations.length >= 5;
  const dimensionSurface = getDimensionSurface(displayDimension);
  const actionPresentation = getDimensionActionPresentation(
    displayDimension.status,
  );
  const isPreservation = displayDimension.status === "green";

  return (
    <div className="dashboard-mock-page dashboard-recommendations-screen">
      <DashboardHeading
        title={`${actionPresentation.actionsTitle} | ${displayDimension.conceptLabel}`}
        organizationName={organizationName}
        roundTitle={roundTitle}
      />
      <DimensionIdentityChip dimension={displayDimension} />

      <section
        className={`dashboard-recommendations-stage${isFiveItemLayout ? " is-five-items" : " is-generic-items"}`}
        aria-label={`${actionPresentation.actionsTitle} עבור ${displayDimension.conceptLabel}`}
      >
        {recommendations.map((recommendation, index) => {
          const className = isFiveItemLayout
            ? recommendationBlobClasses[index] ?? recommendationBlobClasses.at(-1)!
            : "dashboard-recommendation-blob dashboard-recommendation-blob-generic";

          if (isPreservation) {
            return (
              <PreservationRecommendationBlob
                key={recommendation.title}
                recommendation={recommendation}
                className={className}
                color={dimensionSurface}
                priority={index + 1}
                featured={index === 0}
                itemLabel={actionPresentation.actionItemLabel}
              />
            );
          }

          return (
            <RecommendationBlob
              key={recommendation.title}
              recommendation={recommendation}
              color={dimensionSurface}
              priority={index + 1}
              featured={index === 0}
              className={className}
            />
          );
        })}
      </section>

      <DashboardCtaRow
        center
        actions={getDashboardRecommendationsActions()}
      />
    </div>
  );
}
