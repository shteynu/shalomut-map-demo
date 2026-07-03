"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Download,
  House,
  Info,
  Lightbulb,
  LockKeyhole,
  MousePointer2,
  Move,
  type LucideIcon,
} from "lucide-react";
import { DashboardMapInteractive } from "@/components/dashboard-map-interactive";
import { ScoreRing } from "@/components/score-ring";
import {
  activeRound,
  getDimensionSurface,
  organization,
  overallScore,
  statusLabels,
  type ResponseMetric,
  type WellbeingDimension,
} from "@/lib/demo-data";
import { DimensionIcon } from "@/components/dimension-icon";
import {
  getDashboardDetailActions,
  getDashboardMetricsActions,
  getDashboardRecommendationsActions,
  getNavigationAction,
  navigationLabels,
  type DashboardActionId,
  type DashboardNavigationAction,
} from "@/lib/navigation";

function useBlobFit(dependencyKey: string) {
  const containerRef = useRef<HTMLDivElement | HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const adjust = () => {
      content.style.fontSize = "1em";

      const containerRect = container.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();

      const W = containerRect.width;
      const H = containerRect.height;
      const w = contentRect.width;
      const h = contentRect.height;

      if (W === 0 || H === 0 || w === 0 || h === 0) return;

      const widthRatio = w / W;
      const heightRatio = h / H;
      const diagonalRatio = Math.sqrt(widthRatio * widthRatio + heightRatio * heightRatio);

      const maxSafeW = W - 32;
      const maxSafeH = H - 32;

      const scaleW = maxSafeW / w;
      const scaleH = maxSafeH / h;
      const scaleDiag = 0.83 / diagonalRatio;

      const neededScale = Math.max(0.65, Math.min(1.0, scaleW, scaleH, scaleDiag));
      content.style.fontSize = `${neededScale}em`;
    };

    adjust();

    const resizeObserver = new ResizeObserver(adjust);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [dependencyKey]);

  return { containerRef, contentRef };
}

const recommendationBlobClasses = [
  "dashboard-recommendation-blob dashboard-recommendation-blob-top-left",
  "dashboard-recommendation-blob dashboard-recommendation-blob-top-right",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-left",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-center",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-right",
];

const dashboardActionIcons: Record<DashboardActionId, LucideIcon> = {
  dimensionMetrics: BarChart3,
  dimensionRecommendations: Lightbulb,
  dashboardMap: ChevronRight,
};

function DashboardHomeLink() {
  const backToMainAction = getNavigationAction("backToMain");

  return (
    <Link className="dashboard-home-link" href={backToMainAction.href} aria-label={backToMainAction.label}>
      <House size={19} aria-hidden="true" />
      <span>{backToMainAction.label}</span>
    </Link>
  );
}

function DashboardCtaRow({ actions, center = false }: { actions: DashboardNavigationAction[]; center?: boolean }) {
  return (
    <nav className={`dashboard-cta-row${center ? " dashboard-cta-row-center" : ""}`} aria-label="ניווט מסך">
      {actions.map((action) => {
        const Icon = dashboardActionIcons[action.id];
        return (
          <Link
            key={`${action.href}-${action.label}`}
            className={`dashboard-pill-button dashboard-pill-button-${action.variant}`}
            href={action.href}
          >
            {action.label}
            <Icon size={22} aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}

function DashboardHeading({ title }: { title: string }) {
  return (
    <header className="dashboard-heading">
      <DashboardHomeLink />
      <h1>{title}</h1>
      <p>
        {organization.name}, {activeRound.period}
      </p>
    </header>
  );
}

function DimensionIdentityChip({ dimension }: { dimension: WellbeingDimension }) {
  return (
    <div className="dashboard-dimension-chip" aria-label={`${dimension.conceptLabel}, ${statusLabels[dimension.status]}`}>
      <DimensionIcon dimensionId={dimension.id} size={18} />
      <span>{dimension.conceptLabel}</span>
      <small>{statusLabels[dimension.status]}</small>
    </div>
  );
}

function getHighlightedMetrics(dimension: WellbeingDimension) {
  const highlighted = dimension.metrics.filter((metric) => metric.highlightText);

  if (highlighted.length >= 2) {
    return highlighted.slice(0, 2);
  }

  const fallback = dimension.metrics.filter((metric) => !highlighted.includes(metric));
  return [...highlighted, ...fallback].slice(0, 2);
}

function getDisplayRecommendations(dimension: WellbeingDimension) {
  if (dimension.id === "social-resource" && dimension.recommendations.length >= 5) {
    const order = [2, 0, 1, 3, 4];
    return order.map((index) => dimension.recommendations[index]).filter(Boolean);
  }

  return dimension.recommendations;
}

function MetricBlob({
  metric,
  color,
  emphasis = "secondary",
  onRed = false,
}: {
  metric: ResponseMetric;
  color?: string;
  emphasis?: "primary" | "secondary";
  onRed?: boolean;
}) {
  const fitKey = `${metric.label}-${metric.value}-${metric.highlightText ?? metric.helper}`;
  const { containerRef, contentRef } = useBlobFit(fitKey);
  return (
    <article
      ref={containerRef as any}
      className={`dashboard-metric-blob dashboard-metric-blob-${emphasis}${onRed ? " is-on-red" : ""}`}
      style={{ "--dimension-surface": color } as CSSProperties}
    >
      <div ref={contentRef as any} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <span className="dashboard-metric-label">{metric.label}</span>
        <strong>{metric.value}</strong>
        <p>{metric.highlightText ?? metric.helper}</p>
      </div>
    </article>
  );
}

function RecommendationBlob({
  recommendation,
  className,
  color,
  priority,
  featured = false,
  onRed = false,
}: {
  recommendation: { title: string; body: string };
  className: string;
  color?: string;
  priority: number;
  featured?: boolean;
  onRed?: boolean;
}) {
  const { containerRef, contentRef } = useBlobFit(`${recommendation.title}-${recommendation.body}`);
  return (
    <article
      ref={containerRef as any}
      className={`${className}${featured ? " is-featured" : ""}${onRed ? " is-on-red" : ""}`}
      style={{ "--dimension-surface": color } as CSSProperties}
    >
      <div ref={contentRef as any} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <span className="dashboard-recommendation-priority">{priority === 1 ? "יעד ראשון" : `יעד ${priority}`}</span>
        <h2>{recommendation.title}</h2>
        <p>{recommendation.body}</p>
      </div>
    </article>
  );
}

function DashboardMapLocked() {
  const remaining = activeRound.minimumResponses - activeRound.responseCount;
  const distributeSurveyAction = getNavigationAction("distributeSurvey");

  return (
    <section className="map-locked-stone" aria-label="המפה נעולה עד להגעה לסף הפרטיות">
      <LockKeyhole size={42} aria-hidden="true" />
      <h2>המפה עדיין נעולה</h2>
      <span className="map-locked-count">
        <strong>{activeRound.responseCount}</strong>
        <span>מתוך {activeRound.minimumResponses} תשובות נדרשות</span>
      </span>
      <p>
        עוד {remaining} תשובות והמפה תיפתח. הסף הזה שומר על האנונימיות של הצוות: התוצאות מוצגות רק
        כשאי אפשר לזהות משיב בודד. בינתיים מוצג מספר המשיבים הכללי בלבד.
      </p>
      <Link className="primary-button" href={distributeSurveyAction.href}>
        {distributeSurveyAction.label}
        <ArrowLeft size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function DashboardMapPage() {
  const isLocked = activeRound.responseCount < activeRound.minimumResponses;

  if (isLocked) {
    return (
      <div className="dashboard-mock-page stone-page">
        <DashboardHeading title="מפת השלומות" />
        <DashboardMapLocked />
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
            {organization.name}, {activeRound.period}
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
              {activeRound.minimumResponses} משיבים) כדי לשמור על אנונימיות.
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
          <DashboardMapInteractive />
        </div>
      </div>
    </div>
  );
}

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

      <DashboardCtaRow
        actions={getDashboardDetailActions(dimension.id)}
      />
    </div>
  );
}

export function DashboardMetricsPage({ dimension }: { dimension: WellbeingDimension }) {
  const metrics = getHighlightedMetrics(dimension).reverse();
  const dimensionSurface = getDimensionSurface(dimension);

  return (
    <div className="dashboard-mock-page dashboard-metrics-screen">
      <DashboardHeading title={`${navigationLabels.highlightedMetrics} | ${dimension.conceptLabel}`} />
      <DimensionIdentityChip dimension={dimension} />

      <section className="dashboard-metrics-stage" aria-label={`${navigationLabels.highlightedMetrics} עבור ${dimension.conceptLabel}`}>
        {metrics.map((metric, index) => (
          <MetricBlob
            key={`${metric.label}-${metric.value}`}
            metric={metric}
            color={dimensionSurface}
            emphasis={index === 0 ? "primary" : "secondary"}
          />
        ))}
      </section>

      <DashboardCtaRow
        actions={getDashboardMetricsActions(dimension.id)}
      />
    </div>
  );
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

      <DashboardCtaRow
        center
        actions={getDashboardRecommendationsActions()}
      />
    </div>
  );
}
