"use client";

import type { RefObject } from "react";
import { useBlobFit } from "@/lib/hooks/use-blob-fit";
import type { DimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import { getDimensionSurface } from "@/lib/dashboard/dimension-presentation";
import {
  getDashboardStone,
  type DashboardStone,
} from "@/lib/dashboard/dashboard-insights";
import { getDimensionActionPresentation } from "@/lib/ai-insights-view-model";
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
  const { containerRef, contentRef } = useBlobFit(
    `${dimension.id}-${stone?.summary.join("|") ?? ""}`,
  );

  if (state.status !== "ready") {
    return (
      <div className="dashboard-mock-page dashboard-detail-screen">
        <DashboardHeading
          title={`תמונת מצב | ${dimension.conceptLabel}`}
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        <DashboardAiInsightsState
          state={state}
          onRetry={reload}
          roundId={roundId}
        />
        <DashboardCtaRow
          actions={getDashboardDetailActions(dimension.id, roundId)}
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
          roundId={roundId}
        />
      </div>
    );
  }

  return (
    <DashboardDimensionDetail
      dimension={dimension}
      stone={stone}
      roundId={roundId}
      organizationName={organizationName}
      roundTitle={roundTitle}
      blobRefs={{ containerRef, contentRef }}
    />
  );
}

/**
 * The screen once the analysis is in hand. Split from the state machine above
 * so the DTO path can be rendered and asserted without a fetch.
 */
export function DashboardDimensionDetail({
  dimension,
  stone,
  roundId,
  organizationName,
  roundTitle,
  blobRefs,
}: {
  dimension: DimensionPresentation;
  stone: DashboardStone;
  roundId: string;
  organizationName: string;
  roundTitle: string;
  blobRefs?: {
    containerRef: RefObject<HTMLElement | null>;
    contentRef: RefObject<HTMLElement | null>;
  };
}) {
  const actionPresentation = getDimensionActionPresentation(stone.status);
  const dimensionSurface = getDimensionSurface(stone.status);

  return (
    <div className="dashboard-mock-page dashboard-detail-screen">
      <DashboardHeading
        title={`${actionPresentation.dimensionTitle} | ${dimension.conceptLabel}`}
        organizationName={organizationName}
        roundTitle={roundTitle}
      />
      <DimensionIdentityChip dimension={dimension} status={stone.status} />

      <article
        ref={blobRefs?.containerRef as any}
        className="dashboard-single-blob"
        style={{ backgroundColor: dimensionSurface, display: "grid" }}
      >
        <div ref={blobRefs?.contentRef as any} className="dashboard-single-blob-copy">
          {stone.interpretationUnavailable ? (
            <p role="status">
              הניתוח המילולי לממד הזה לא נוצר בסבב האחרון. הציון, פירוט השאלות
              וההמלצות מלאים, ואפשר להפעיל ניתוח מחדש כדי לנסות שוב.
            </p>
          ) : (
            <>
              {stone.summary.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {stone.summaryIsDeterministic ? (
                <p className="dashboard-blob-provenance" role="note">
                  הפסקאות האלה נגזרו מן הנתונים המצרפיים של הסבב ולא נכתבו על
                  ידי המודל. הן אינן מוסיפות סיבה או פרשנות מעבר למספרים, ואפשר
                  להפעיל ניתוח מחדש כדי לקבל קריאה מלאה.
                </p>
              ) : null}
            </>
          )}
        </div>
      </article>

      <DashboardCtaRow
        actions={getDashboardDetailActions(dimension.id, roundId)}
      />
    </div>
  );
}
