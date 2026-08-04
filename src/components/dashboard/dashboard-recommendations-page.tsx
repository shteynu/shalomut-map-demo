"use client";

import type { CSSProperties } from "react";
import type { DimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import { getDimensionSurface } from "@/lib/dashboard/dimension-presentation";
import {
  getDashboardStone,
  type DashboardRecommendation,
  type DashboardStone,
} from "@/lib/dashboard/dashboard-insights";
import { useBlobFit } from "@/lib/hooks/use-blob-fit";
import { getDimensionActionPresentation } from "@/lib/ai-insights-view-model";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import { getDashboardRecommendationsActions, navigationLabels } from "@/lib/navigation";
import { DashboardAiInsightsState } from "./dashboard-ai-insights-state";
import { DashboardCtaRow } from "./dashboard-cta-row";
import { DashboardGoalsPanel } from "./dashboard-goals-panel";
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

function getDisplayRecommendations(stone: DashboardStone) {
  return stone.recommendations;
}

function PreservationRecommendationBlob({
  recommendation,
  className,
  color,
  priority,
  featured,
  itemLabel,
}: {
  recommendation: DashboardRecommendation;
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
      <div className="dashboard-mock-page dashboard-recommendations-screen">
        <DashboardHeading
          title={`${navigationLabels.goals} | ${dimension.conceptLabel}`}
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        <DashboardAiInsightsState state={state} onRetry={reload} roundId={roundId} />
        <DashboardCtaRow
          center
          actions={getDashboardRecommendationsActions(roundId)}
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

  return (
    <DashboardRecommendationsStage
      dimension={dimension}
      stone={stone}
      roundId={roundId}
      organizationName={organizationName}
      roundTitle={roundTitle}
    />
  );
}

/**
 * The screen once the analysis is in hand. Split from the state machine above
 * so the DTO path can be rendered and asserted without a fetch.
 */
export function DashboardRecommendationsStage({
  dimension,
  stone,
  roundId,
  organizationName,
  roundTitle,
}: {
  dimension: DimensionPresentation;
  stone: DashboardStone;
  roundId: string;
  organizationName: string;
  roundTitle: string;
}) {
  const recommendations = getDisplayRecommendations(stone);
  const isFiveItemLayout = recommendations.length >= 5;
  const dimensionSurface = getDimensionSurface(stone.status);
  const actionPresentation = getDimensionActionPresentation(stone.status);
  const isPreservation = stone.status === "green";

  return (
    <div className="dashboard-mock-page dashboard-recommendations-screen">
      <DashboardHeading
        title={`${actionPresentation.actionsTitle} | ${dimension.conceptLabel}`}
        organizationName={organizationName}
        roundTitle={roundTitle}
      />
      <DimensionIdentityChip dimension={dimension} status={stone.status} />

      <section
        className={`dashboard-recommendations-stage${isFiveItemLayout ? " is-five-items" : " is-generic-items"}`}
        aria-label={`${actionPresentation.actionsTitle} עבור ${dimension.conceptLabel}`}
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

      <DashboardGoalsPanel
        roundId={roundId}
        dimensionId={dimension.id}
        dimensionLabel={dimension.conceptLabel}
        recommendations={recommendations}
      />

      <DashboardCtaRow
        center
        actions={getDashboardRecommendationsActions(roundId)}
      />
    </div>
  );
}
