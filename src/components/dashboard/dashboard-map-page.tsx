"use client";

import { Download, Info, MousePointer2, Move } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import type { DimensionDivision } from "@/lib/dashboard/dimension-division";
import {
  isNearBandEdge,
  minimumReadableDelta,
  type RoundComparison,
} from "@/lib/dashboard/round-comparison";
import type { RoundSwitcherOptions } from "@/lib/rounds/round-options";
import type { AiInsightsUiState } from "@/lib/hooks/use-ai-insights";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import type { WellbeingDimensionId, WellbeingStatus } from "@/lib/shalomut-source";
import { DashboardAiInsightsState } from "./dashboard-ai-insights-state";
import { DashboardMapInteractive } from "./dashboard-map-interactive";
import { DashboardHeading } from "./dashboard-heading";
import { DashboardHomeLink } from "./dashboard-home-link";
import { DashboardMapLocked } from "./dashboard-map-locked";
import { DashboardDividedDimensionsNotice } from "./dashboard-divided-dimensions-notice";
import { DashboardPartialMapNotice } from "./dashboard-partial-map-notice";
import { DashboardRoundComparison } from "./dashboard-round-comparison";
import { RoundSwitcher } from "@/components/round/round-switcher";

type DashboardMapPageProps = {
  roundId: string;
  organizationName: string;
  roundTitle: string;
  responseCount: number;
  minimumResponses: number;
  overallScore: number;
  dimensionScores: Record<
    WellbeingDimensionId,
    { averageScore: number; computedStatus: WellbeingStatus }
  >;
  roundOptions: RoundSwitcherOptions;
  roundSwitcherAction: string;
  /** The previous round's numbers, when there is a comparable one. */
  comparison: RoundComparison | null;
  /** Dimensions whose answers split between the two ends of the scale. */
  divisions: DimensionDivision[];
  /**
   * Whether this round's numbers are withheld, as the analysis decided it.
   *
   * Passed in rather than recomputed here. This screen used to decide for
   * itself with `responseCount < minimumResponses`, which is one of the three
   * conditions the analysis actually uses — it also locks a round whose
   * questionnaire does not cover every dimension, and one where a single
   * question drew fewer answers than the threshold. When the two disagreed the
   * analysis withheld `dimensionScores` and this screen rendered the map
   * anyway, which is a crash on the manager's main page rather than a wrong
   * number.
   */
  isLocked: boolean;
};

export function DashboardMapPage({
  roundId,
  organizationName,
  roundTitle,
  responseCount,
  minimumResponses,
  overallScore,
  dimensionScores,
  roundOptions,
  roundSwitcherAction,
  comparison,
  divisions,
  isLocked,
}: DashboardMapPageProps) {

  if (isLocked) {
    return (
      <div className="dashboard-page stone-page">
        <DashboardHeading
          title="מפת השלומות"
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        {/* A locked round is exactly when a manager wants the other rounds. */}
        <RoundSwitcher
          options={roundOptions}
          action={roundSwitcherAction}
          align="center"
        />
        <DashboardMapLocked
          responseCount={responseCount}
          minimumResponses={minimumResponses}
        />
      </div>
    );
  }

  return (
    <DashboardMapReady
      roundId={roundId}
      organizationName={organizationName}
      roundTitle={roundTitle}
      minimumResponses={minimumResponses}
      overallScore={overallScore}
      dimensionScores={dimensionScores}
      roundOptions={roundOptions}
      roundSwitcherAction={roundSwitcherAction}
      comparison={comparison}
      divisions={divisions}
      responseCount={responseCount}
    />
  );
}

export function DashboardOverviewSummary({
  state,
  onRetry,
  roundId,
}: {
  state: AiInsightsUiState;
  onRetry: () => void;
  roundId?: string;
}) {
  if (state.status !== "ready") {
    return (
      <DashboardAiInsightsState
        state={state}
        onRetry={onRetry}
        roundId={roundId}
      />
    );
  }

  const summary = state.value.overallSummary;

  if (!summary) {
    return (
      <DashboardAiInsightsState
        state={{ status: "error", error: "Missing organization summary." }}
        onRetry={onRetry}
        roundId={roundId}
      />
    );
  }

  return (
    <section className="dashboard-ai-state" aria-labelledby="dashboard-overview-summary-title">
      <h2 id="dashboard-overview-summary-title">סיכום ארגוני</h2>
      <p>{summary}</p>
    </section>
  );
}

function DashboardMapReady({
  roundId,
  organizationName,
  roundTitle,
  minimumResponses,
  overallScore,
  dimensionScores,
  roundOptions,
  roundSwitcherAction,
  comparison,
  divisions,
  responseCount,
}: Omit<DashboardMapPageProps, "isLocked">) {
  const { state, reload } = useAiInsights(roundId);

  /*
   * How many colours this round could have chosen either way.
   *
   * Said once, as a count, rather than marked on each stone: with ten
   * respondents one person is worth ten points, so in a school scoring in the
   * forties and fifties every stone sits near the 50 edge, and eight identical
   * warnings tell a principal less than one sentence does.
   */
  const scoreResolution = minimumReadableDelta(responseCount, responseCount);
  const dimensionsNearEdge = Object.values(dimensionScores).filter((entry) =>
    isNearBandEdge(entry.averageScore, scoreResolution),
  ).length;

  return (
    <div className="dashboard-page stone-page dashboard-map-screen">
      <DashboardHomeLink />

      <div className="dashboard-map-layout">
        <aside className="map-sidebar" aria-label="סיכום מצב נוכחי">
          <p className="eyebrow">מצב נוכחי</p>
          <h1>מפת השלומות</h1>
          <p className="map-sidebar-org">
            {organizationName}, {roundTitle}
          </p>

          <RoundSwitcher
            options={roundOptions}
            action={roundSwitcherAction}
            align="center"
          />

          <div className="score-ring-card">
            <div className="score-ring-value">
              <small>ציון כולל</small>
              <strong>{overallScore}</strong>
              <small>מתוך 100</small>
            </div>
            <ScoreRing value={overallScore} />
          </div>

          {comparison ? (
            <DashboardRoundComparison comparison={comparison} />
          ) : null}

          <DashboardDividedDimensionsNotice divisions={divisions} />

          {dimensionsNearEdge > 0 ? (
            <p className="map-sidebar-band-note">
              {dimensionsNearEdge === Object.keys(dimensionScores).length
                ? "כל הממדים"
                : `${dimensionsNearEdge} ממדים`}{" "}
              נמצאים במרחק של פחות מ־{scoreResolution} נקודות מגבול הקטגוריה, וזה
              בדיוק המרחק שמשיב אחד יכול להזיז ב־{responseCount} משיבים. הצבע שם
              הוא הערכה, לא הכרעה.
            </p>
          ) : null}

          <p className="map-sidebar-desc">
            המפה מציגה תמונת מצב עדכנית של ממדי השלומות בבית הספר. כל אבן מייצגת ממד אחד,
            והנקודה הצבעונית לצידה מסמנת את הסטטוס שלו.
          </p>

          <DashboardOverviewSummary
            state={state}
            onRetry={reload}
            roundId={roundId}
          />

          {/* Beside the summary, not above the map: the gap is a fact about
              this analysis, and the sidebar is where the analysis is read. */}
          {state.status === "ready" ? (
            <DashboardPartialMapNotice gaps={state.value.gapsByReason} />
          ) : null}

          <button type="button" className="primary-button" onClick={() => window.print()}>
            <Download size={18} aria-hidden="true" />
            הורדת דוח
          </button>

          <div className="map-privacy-note">
            <Info size={20} aria-hidden="true" />
            <p>
              הגנת פרטיות מופעלת: הנתונים מוצגים ברמה מצרפית בלבד (מינימום{" "}
              {minimumResponses} משיבים) כדי לשמור על אנונימיות.
            </p>
          </div>
        </aside>

        <div className="map-stage-column">
          <div className="dashboard-map-hint" aria-label="הנחיית שימוש במפה">
            <Move className="hint-icon-desktop" size={18} aria-hidden="true" />
            <MousePointer2 className="hint-icon-mobile" size={18} aria-hidden="true" />
            <span className="hint-text-desktop">
              גררו את האבנים כדי לסדר את המפה, או לחצו על אבן כדי לפתוח פירוט.
              במקלדת: מקשי החיצים מזיזים את האבן שבמיקוד, ועם Shift בצעד גדול.
            </span>
            <span className="hint-text-mobile">לחצו על אבן כדי לפתוח פירוט.</span>
          </div>
          <DashboardMapInteractive
            dimensionScores={dimensionScores}
            roundId={roundId}
            dimensionDeltas={comparison?.dimensionDeltas ?? null}
            divisions={divisions}
            minimumReadableDelta={
              comparison?.minimumReadableDelta ?? Number.POSITIVE_INFINITY
            }
            responseCount={responseCount}
          />
        </div>
      </div>
    </div>
  );
}
