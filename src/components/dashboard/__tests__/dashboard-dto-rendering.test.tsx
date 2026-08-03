import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardStone } from "@/lib/dashboard/dashboard-insights";
import { getDimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import { DashboardDimensionDetail } from "../dashboard-dimension-page";
import { DashboardMetricsStage } from "../dashboard-metrics-page";
import { DashboardRecommendationsStage } from "../dashboard-recommendations-page";

/**
 * What the three detail screens do with a `DashboardInsightsDto` stone.
 *
 * These render the ready state directly, which the page components cannot do
 * in a test: they own the fetch. Before the DTO the same assertions needed a
 * `WellbeingDimension` carrying demo analysis, so a screen could pass while
 * showing fixture copy.
 */
const dimension = getDimensionPresentation("balance")!;

function stone(overrides: Partial<DashboardStone> = {}): DashboardStone {
  return {
    dimensionId: "balance",
    score: 62,
    status: "yellow",
    summary: ["פסקה ראשונה על האיזון.", "פסקה שנייה על ההתאוששות."],
    interpretationUnavailable: false,
    metrics: [
      {
        label: "יש לי מספיק זמן למנוחה ולהתאוששות אחרי העבודה.",
        value: "48.5 מתוך 100",
        helper: "14 משיבים · 4 גבוה · 6 באמצע · 4 נמוך",
        distribution: { green: 4, yellow: 6, red: 4 },
      },
    ],
    recommendations: [
      { title: "חלונות זמן מוגנים", body: "להגן על זמן הכנה." },
    ],
    ...overrides,
  };
}

function renderDetail(value: DashboardStone) {
  return renderToStaticMarkup(
    <DashboardDimensionDetail
      dimension={dimension}
      stone={value}
      roundId="round-1"
      organizationName="בית ספר"
      roundTitle="סבב אבחון"
    />,
  );
}

test("the detail screen renders every summary paragraph the stone carries", () => {
  const html = renderDetail(stone());

  assert.match(html, /פסקה ראשונה על האיזון\./);
  assert.match(html, /פסקה שנייה על ההתאוששות\./);
  assert.doesNotMatch(html, /הניתוח המילולי לממד הזה לא נוצר/);
});

test("a dimension the provider never interpreted says so instead of showing nothing", () => {
  const html = renderDetail(
    stone({ summary: [], interpretationUnavailable: true }),
  );

  assert.match(html, /הניתוח המילולי לממד הזה לא נוצר בסבב האחרון/);
  assert.match(html, /role="status"/);
});

test("the metrics screen shows the question text, its average and its split", () => {
  const html = renderToStaticMarkup(
    <DashboardMetricsStage
      dimension={dimension}
      stone={stone()}
      roundId="round-1"
      organizationName="בית ספר"
      roundTitle="סבב אבחון"
    />,
  );

  assert.match(html, /יש לי מספיק זמן למנוחה ולהתאוששות אחרי העבודה\./);
  assert.match(html, /48\.5 מתוך 100/);
  // The counts are in the sentence; the bar beside it is decoration only.
  assert.match(html, /14 משיבים · 4 גבוה · 6 באמצע · 4 נמוך/);
  assert.match(html, /aria-hidden="true"/);
});

test("a green dimension gets preservation language, a yellow one gets goals", () => {
  const preservation = renderToStaticMarkup(
    <DashboardRecommendationsStage
      dimension={dimension}
      stone={stone({ status: "green" })}
      roundId="round-1"
      organizationName="בית ספר"
      roundTitle="סבב אבחון"
    />,
  );
  const goals = renderToStaticMarkup(
    <DashboardRecommendationsStage
      dimension={dimension}
      stone={stone()}
      roundId="round-1"
      organizationName="בית ספר"
      roundTitle="סבב אבחון"
    />,
  );

  assert.match(preservation, /פעולות לשימור/);
  assert.match(preservation, /פעולת שימור 1/);
  assert.doesNotMatch(preservation, /מטרות ויעדים/);

  assert.match(goals, /מטרות ויעדים/);
  assert.doesNotMatch(goals, /פעולות לשימור/);
  assert.match(goals, /חלונות זמן מוגנים/);
});
