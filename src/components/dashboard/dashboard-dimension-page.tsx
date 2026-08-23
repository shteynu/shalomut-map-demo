"use client";

import type { RefObject } from "react";
import { useBlobFit } from "@/lib/hooks/use-blob-fit";
import type { DimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import { getDimensionSurface } from "@/lib/dashboard/dimension-presentation";
import {
  getDashboardStone,
  type DashboardStone,
  type InterpretationGapReason,
} from "@/lib/dashboard/dashboard-insights";
import { getDimensionActionPresentation } from "@/lib/ai-insights-view-model";
import {
  useAiInsights,
  type AiInsightsWatchStatus,
} from "@/lib/hooks/use-ai-insights";
import { getDashboardDetailActions } from "@/lib/navigation";
import {
  DashboardAiArrivedNotice,
  DashboardAiInsightsState,
} from "./dashboard-ai-insights-state";
import { DashboardCtaRow } from "./dashboard-cta-row";
import { DashboardDimensionRerun } from "./dashboard-dimension-rerun";
import { DashboardHeading } from "./dashboard-heading";
import { DimensionIdentityChip } from "./dimension-identity-chip";

export function DashboardDimensionPage({
  dimension,
  roundId,
  organizationName,
  roundTitle,
  mayAct,
}: {
  dimension: DimensionPresentation;
  roundId: string;
  organizationName: string;
  roundTitle: string;
  /**
   * Whether the reader may ask for this dimension to be analysed again. A
   * school user reads the map and does not re-run it (owner decision,
   * 2026-08-23); the note explaining that the text is deterministic stays,
   * because it is true whoever is reading.
   */
  mayAct: boolean;
}) {
  const { state, reload, watch } = useAiInsights(roundId);
  const stone =
    state.status === "ready"
      ? getDashboardStone(state.value, dimension.id)
      : undefined;
  const { containerRef, contentRef } = useBlobFit(
    `${dimension.id}-${stone?.summary.join("|") ?? ""}`,
  );

  if (state.status !== "ready") {
    return (
      <div className="dashboard-page dashboard-detail-screen">
        <DashboardHeading
          title={`תמונת מצב | ${dimension.conceptLabel}`}
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        <DashboardAiInsightsState
          state={state}
          onRetry={reload}
          watch={watch}
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
      <div className="dashboard-page dashboard-detail-screen">
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
      watch={watch}
      onRerunQueued={reload}
      blobRefs={{ containerRef, contentRef }}
      mayAct={mayAct}
    />
  );
}

const INTACT = "הציון, פירוט השאלות וההמלצות של הממד הזה מלאים";

/**
 * What to tell a manager looking at a dimension with no words.
 *
 * The two causes lead to different next moves, which is the whole reason the
 * reason travels: a service that did not answer is worth retrying in a minute,
 * and copy this service refused is worth retrying for a different wording — or
 * not at all, if it keeps being refused. A round from before the service
 * recorded a cause gets the sentence that claims neither.
 */
function gapCopy(reason: InterpretationGapReason | undefined): string {
  if (reason === "provider_unavailable") {
    return (
      `שירות הניתוח לא השיב עבור הממד הזה בסבב האחרון. ${INTACT}, ` +
      "ואפשר להפעיל ניתוח מחדש בעוד מספר דקות."
    );
  }
  if (reason === "validation_rejected") {
    return (
      "הניתוח המילולי שנוצר לממד הזה לא עמד בבדיקות האיכות של המערכת ולכן " +
      `לא הוצג. ${INTACT}, ואפשר להפעיל ניתוח מחדש כדי לקבל ניסוח אחר.`
    );
  }
  return (
    `הניתוח המילולי לממד הזה לא נוצר בסבב האחרון. ${INTACT}, ואפשר להפעיל ` +
    "ניתוח מחדש כדי לנסות שוב."
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
  watch,
  onRerunQueued,
  blobRefs,
  mayAct = true,
}: {
  dimension: DimensionPresentation;
  stone: DashboardStone;
  roundId: string;
  organizationName: string;
  roundTitle: string;
  watch?: AiInsightsWatchStatus;
  /** See `DashboardDimensionPage`. */
  mayAct?: boolean;
  /** Read the round again, so the queued re-run becomes a watched one. */
  onRerunQueued?: () => void;
  blobRefs?: {
    containerRef: RefObject<HTMLElement | null>;
    contentRef: RefObject<HTMLElement | null>;
  };
}) {
  const actionPresentation = getDimensionActionPresentation(stone.status);
  const dimensionSurface = getDimensionSurface(stone.status);

  return (
    <div className="dashboard-page dashboard-detail-screen">
      <DashboardHeading
        title={`${actionPresentation.dimensionTitle} | ${dimension.conceptLabel}`}
        organizationName={organizationName}
        roundTitle={roundTitle}
      />
      <DimensionIdentityChip dimension={dimension} status={stone.status} />
      <DashboardAiArrivedNotice watch={watch} />

      <article
        ref={blobRefs?.containerRef as any}
        className="dashboard-single-blob"
        style={{ backgroundColor: dimensionSurface, display: "grid" }}
      >
        <div ref={blobRefs?.contentRef as any} className="dashboard-single-blob-copy">
          {stone.interpretationUnavailable ? (
            <p role="status">
              {gapCopy(stone.interpretationUnavailableReason)}
            </p>
          ) : (
            <>
              {stone.summary.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {stone.summaryIsDeterministic ? (
                <>
                  <p className="dashboard-blob-provenance" role="note">
                    הפסקאות האלה נגזרו מן הנתונים המצרפיים של הסבב ולא נכתבו על
                    ידי המודל. הן אינן מוסיפות סיבה או פרשנות מעבר למספרים,
                    ואפשר להפעיל ניתוח מחדש לממד הזה כדי לקבל קריאה מלאה.
                  </p>
                  {mayAct ? (
                    <DashboardDimensionRerun
                      roundId={roundId}
                      dimensionId={dimension.id}
                      onQueued={onRerunQueued}
                    />
                  ) : null}
                </>
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
