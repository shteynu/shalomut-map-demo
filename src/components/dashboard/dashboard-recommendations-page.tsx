"use client";

import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import {
  applyStoneInsightToDimension,
  getStoneInsight,
} from "@/lib/ai-insights-view-model";
import { useDashboardRoundId } from "@/lib/hooks/use-dashboard-round-id";
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
  if (dimension.id === "social-resource" && dimension.recommendations.length >= 5) {
    const order = [2, 0, 1, 3, 4];
    return order.map((index) => dimension.recommendations[index]).filter(Boolean);
  }

  return dimension.recommendations;
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
  const resolvedRoundId = useDashboardRoundId(roundId);
  const { state, reload } = useAiInsights(resolvedRoundId);
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
        <DashboardAiInsightsState state={state} onRetry={reload} />
        <DashboardCtaRow
          center
          actions={getDashboardRecommendationsActions()}
          roundId={resolvedRoundId}
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
        />
      </div>
    );
  }

  const displayDimension = applyStoneInsightToDimension(
    dimension,
    stone,
    state.value.overallPsychologicalSummary,
  );
  const recommendations = getDisplayRecommendations(displayDimension);
  const isFiveItemLayout = recommendations.length >= 5;
  const dimensionSurface = getDimensionSurface(displayDimension);

  return (
    <div className="dashboard-mock-page dashboard-recommendations-screen">
      <DashboardHeading
        title={`${navigationLabels.goals} | ${displayDimension.conceptLabel}`}
        organizationName={organizationName}
        roundTitle={roundTitle}
      />
      <DimensionIdentityChip dimension={displayDimension} />

      <section
        className={`dashboard-recommendations-stage${isFiveItemLayout ? " is-five-items" : " is-generic-items"}`}
        aria-label={`${navigationLabels.goals} עבור ${displayDimension.conceptLabel}`}
      >
        {recommendations.map((recommendation, index) => (
          <RecommendationBlob
            key={recommendation.title}
            recommendation={recommendation}
            color={dimensionSurface}
            priority={index + 1}
            featured={index === 0}
            className={
              isFiveItemLayout
                ? recommendationBlobClasses[index] ?? recommendationBlobClasses.at(-1)!
                : "dashboard-recommendation-blob dashboard-recommendation-blob-generic"
            }
          />
        ))}
      </section>

      <DashboardCtaRow
        center
        actions={getDashboardRecommendationsActions()}
        roundId={resolvedRoundId}
      />
    </div>
  );
}
