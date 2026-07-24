"use client";

import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import { getDashboardRecommendationsActions, navigationLabels } from "@/lib/navigation";
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

export function DashboardRecommendationsPage({ dimension }: { dimension: WellbeingDimension }) {
  const recommendations = getDisplayRecommendations(dimension);
  const isFiveItemLayout = recommendations.length >= 5;
  const dimensionSurface = getDimensionSurface(dimension);

  return (
    <div className="dashboard-mock-page dashboard-recommendations-screen">
      <DashboardHeading title={`${navigationLabels.goals} | ${dimension.conceptLabel}`} />
      <DimensionIdentityChip dimension={dimension} />

      <section
        className={`dashboard-recommendations-stage${isFiveItemLayout ? " is-five-items" : " is-generic-items"}`}
        aria-label={`${navigationLabels.goals} עבור ${dimension.conceptLabel}`}
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

      <DashboardCtaRow center actions={getDashboardRecommendationsActions()} />
    </div>
  );
}
