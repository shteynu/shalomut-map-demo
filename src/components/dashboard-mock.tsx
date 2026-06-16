import Link from "next/link";
import { BarChart3, ChevronLeft, House, Lightbulb, Move } from "lucide-react";
import { DashboardMapInteractive } from "@/components/dashboard-map-interactive";
import { activeRound, organization, type ResponseMetric, type WellbeingDimension } from "@/lib/demo-data";

const recommendationBlobClasses = [
  "dashboard-recommendation-blob dashboard-recommendation-blob-top-left",
  "dashboard-recommendation-blob dashboard-recommendation-blob-top-right",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-left",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-center",
  "dashboard-recommendation-blob dashboard-recommendation-blob-bottom-right",
];

function DashboardHeading({ title }: { title: string }) {
  return (
    <header className="dashboard-heading">
      <Link className="dashboard-home-link" href="/" aria-label="חזרה למסך הראשי">
        <House size={19} aria-hidden="true" />
        <span>חזרה למסך הראשי</span>
      </Link>
      <h1>{title}</h1>
      <p>
        {organization.name}, {activeRound.period}
      </p>
    </header>
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

function MetricBlob({ metric }: { metric: ResponseMetric }) {
  return (
    <article className="dashboard-metric-blob">
      <strong>{metric.value}</strong>
      <p>{metric.highlightText ?? metric.helper}</p>
    </article>
  );
}

export function DashboardMapPage() {
  return (
    <div className="dashboard-mock-page">
      <DashboardHeading title="מפת השלומות" />
      <div className="dashboard-map-hint" aria-label="הנחיית שימוש במפה">
        <Move size={18} aria-hidden="true" />
        <span>גררו את האבנים כדי לסדר את המפה, או לחצו על אבן כדי לפתוח פירוט.</span>
      </div>
      <DashboardMapInteractive />
    </div>
  );
}

export function DashboardDimensionPage({ dimension }: { dimension: WellbeingDimension }) {
  return (
    <div className="dashboard-mock-page dashboard-detail-screen">
      <DashboardHeading title={`תמונת מצב | ${dimension.conceptLabel}`} />

      <section className="dashboard-single-blob" style={{ backgroundColor: dimension.conceptColor }}>
        <div className="dashboard-single-blob-copy">
          {dimension.summary.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>

      <nav className="dashboard-cta-row" aria-label="ניווט מסך">
        <Link className="dashboard-pill-button dashboard-pill-button-primary" href={`/dashboard/${dimension.id}/metrics`}>
          נתונים בולטים
          <BarChart3 size={22} aria-hidden="true" />
        </Link>
        <Link className="dashboard-pill-button dashboard-pill-button-secondary" href="/dashboard">
          חזרה למפת השלומות
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}

export function DashboardMetricsPage({ dimension }: { dimension: WellbeingDimension }) {
  const metrics = getHighlightedMetrics(dimension).reverse();

  return (
    <div className="dashboard-mock-page dashboard-metrics-screen">
      <DashboardHeading title={`נתונים בולטים | ${dimension.conceptLabel}`} />

      <section className="dashboard-metrics-stage" aria-label={`נתונים בולטים עבור ${dimension.conceptLabel}`}>
        {metrics.map((metric) => (
          <MetricBlob key={`${metric.label}-${metric.value}`} metric={metric} />
        ))}
      </section>

      <nav className="dashboard-cta-row" aria-label="ניווט מסך">
        <Link
          className="dashboard-pill-button dashboard-pill-button-primary"
          href={`/dashboard/${dimension.id}/recommendations`}
        >
          המלצות לשיפור
          <Lightbulb size={22} aria-hidden="true" />
        </Link>
        <Link className="dashboard-pill-button dashboard-pill-button-secondary" href="/dashboard">
          חזרה למפת השלומות
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}

export function DashboardRecommendationsPage({ dimension }: { dimension: WellbeingDimension }) {
  const recommendations = getDisplayRecommendations(dimension);
  const isFiveItemLayout = recommendations.length >= 5;

  return (
    <div className="dashboard-mock-page dashboard-recommendations-screen">
      <DashboardHeading title={`המלצות לשיפור | ${dimension.conceptLabel}`} />

      <section
        className={`dashboard-recommendations-stage${isFiveItemLayout ? " is-five-items" : " is-generic-items"}`}
        aria-label={`המלצות לשיפור עבור ${dimension.conceptLabel}`}
      >
        {recommendations.map((recommendation, index) => (
          <article
            key={recommendation.title}
            className={
              isFiveItemLayout
                ? recommendationBlobClasses[index] ?? recommendationBlobClasses.at(-1)!
                : "dashboard-recommendation-blob dashboard-recommendation-blob-generic"
            }
          >
            <h2>{recommendation.title}</h2>
            <p>{recommendation.body}</p>
          </article>
        ))}
      </section>

      <nav className="dashboard-cta-row dashboard-cta-row-center" aria-label="ניווט מסך">
        <Link className="dashboard-pill-button dashboard-pill-button-secondary" href="/dashboard">
          חזרה למפת השלומות
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}
