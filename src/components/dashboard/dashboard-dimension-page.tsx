"use client";

import { useBlobFit } from "@/lib/hooks/use-blob-fit";
import type { WellbeingDimension } from "@/lib/demo-data";
import { getDimensionSurface } from "@/lib/demo-data";
import { getDashboardDetailActions } from "@/lib/navigation";
import { DashboardCtaRow } from "./dashboard-cta-row";
import { DashboardHeading } from "./dashboard-heading";
import { DimensionIdentityChip } from "./dimension-identity-chip";

export function DashboardDimensionPage({ dimension }: { dimension: WellbeingDimension }) {
  const dimensionSurface = getDimensionSurface(dimension);
  const { containerRef, contentRef } = useBlobFit(`${dimension.id}-${dimension.summary.join("|")}`);

  return (
    <div className="dashboard-mock-page dashboard-detail-screen">
      <DashboardHeading title={`תמונת מצב | ${dimension.conceptLabel}`} />
      <DimensionIdentityChip dimension={dimension} />

      <article
        ref={containerRef as any}
        className="dashboard-single-blob"
        style={{ backgroundColor: dimensionSurface, display: "grid" }}
      >
        <div ref={contentRef as any} className="dashboard-single-blob-copy">
          {dimension.summary.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>

      <DashboardCtaRow actions={getDashboardDetailActions(dimension.id)} />
    </div>
  );
}
