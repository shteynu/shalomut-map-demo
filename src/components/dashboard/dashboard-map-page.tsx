"use client";

import { Download, Info, MousePointer2, Move } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import type { WellbeingDimensionId, WellbeingStatus } from "@/lib/shalomut-source";
import { DashboardMapInteractive } from "./dashboard-map-interactive";
import { DashboardHeading } from "./dashboard-heading";
import { DashboardHomeLink } from "./dashboard-home-link";
import { DashboardMapLocked } from "./dashboard-map-locked";

type DashboardMapPageProps = {
  organizationName: string;
  roundTitle: string;
  responseCount: number;
  minimumResponses: number;
  overallScore: number;
  dimensionScores: Record<
    WellbeingDimensionId,
    { averageScore: number; computedStatus: WellbeingStatus }
  >;
};

export function DashboardMapPage({
  organizationName,
  roundTitle,
  responseCount,
  minimumResponses,
  overallScore,
  dimensionScores,
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
        <DashboardMapLocked
          responseCount={responseCount}
          minimumResponses={minimumResponses}
        />
      </div>
    );
  }

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
          <DashboardMapInteractive dimensionScores={dimensionScores} />
        </div>
      </div>
    </div>
  );
}
