"use client";

import { Download, Info, MousePointer2, Move } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import type { DashboardRoundOption } from "@/lib/dashboard/round-options";
import type { AiInsightsUiState } from "@/lib/hooks/use-ai-insights";
import { useAiInsights } from "@/lib/hooks/use-ai-insights";
import type { WellbeingDimensionId, WellbeingStatus } from "@/lib/shalomut-source";
import { DashboardAiInsightsState } from "./dashboard-ai-insights-state";
import { DashboardMapInteractive } from "./dashboard-map-interactive";
import { DashboardHeading } from "./dashboard-heading";
import { DashboardHomeLink } from "./dashboard-home-link";
import { DashboardMapLocked } from "./dashboard-map-locked";
import { DashboardRoundSwitcher } from "./dashboard-round-switcher";

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
  roundOptions: DashboardRoundOption[];
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
}: DashboardMapPageProps) {
  const isLocked = responseCount < minimumResponses;

  if (isLocked) {
    return (
      <div className="dashboard-mock-page stone-page">
        <DashboardHeading
          title="מפת השלומות"
          organizationName={organizationName}
          roundTitle={roundTitle}
        />
        {/* A locked round is exactly when a manager wants the other rounds. */}
        <DashboardRoundSwitcher options={roundOptions} />
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
}: Omit<DashboardMapPageProps, "responseCount">) {
  const { state, reload } = useAiInsights(roundId);

  return (
    <div className="dashboard-mock-page stone-page dashboard-map-screen">
      <DashboardHomeLink />

      <div className="dashboard-map-layout">
        <aside className="map-sidebar" aria-label="סיכום מצב נוכחי">
          <p className="eyebrow">מצב נוכחי</p>
          <h1>מפת השלומות</h1>
          <p className="map-sidebar-org">
            {organizationName}, {roundTitle}
          </p>

          <DashboardRoundSwitcher options={roundOptions} />

          <div className="score-ring-card">
            <div className="score-ring-value">
              <small>ציון כולל</small>
              <strong>{overallScore}</strong>
              <small>מתוך 100</small>
            </div>
            <ScoreRing value={overallScore} />
          </div>

          <p className="map-sidebar-desc">
            המפה מציגה תמונת מצב עדכנית של ממדי השלומות בבית הספר. כל אבן מייצגת ממד אחד,
            והנקודה הצבעונית לצידה מסמנת את הסטטוס שלו.
          </p>

          <DashboardOverviewSummary
            state={state}
            onRetry={reload}
            roundId={roundId}
          />

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
            <span className="hint-text-desktop">גררו את האבנים כדי לסדר את המפה, או לחצו על אבן כדי לפתוח פירוט.</span>
            <span className="hint-text-mobile">לחצו על אבן כדי לפתוח פירוט.</span>
          </div>
          <DashboardMapInteractive dimensionScores={dimensionScores} roundId={roundId} />
        </div>
      </div>
    </div>
  );
}
