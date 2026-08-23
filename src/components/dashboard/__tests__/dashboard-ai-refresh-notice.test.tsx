/**
 * What the manager is told about a map that is being replaced.
 *
 * The map now survives a re-analysis, which is the fix; the note is what keeps
 * that from being a silent screen. Without it a manager who pressed "rewrite
 * this dimension" would see the same map, no spinner and no message, and would
 * have no way to tell whether anything had happened — or, after a failed
 * re-run, that the map in front of them is the previous one.
 */
import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardStone } from "@/lib/dashboard/dashboard-insights";
import { getDimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import {
  DashboardAiArrivedNotice,
  DashboardAiRefreshNotice,
} from "../dashboard-ai-insights-state";
import { DashboardDimensionDetail } from "../dashboard-dimension-page";
import { DashboardMetricsStage } from "../dashboard-metrics-page";
import { DashboardRecommendationsStage } from "../dashboard-recommendations-page";

const detailDimension = getDimensionPresentation("balance")!;

/** The smallest stone the three detail screens will render. */
function detailStone(): DashboardStone {
  return {
    dimensionId: "balance",
    score: 62,
    status: "yellow",
    summary: ["פסקה על האיזון."],
    interpretationUnavailable: false,
    summaryIsDeterministic: false,
    metricNarrativesAreDeterministic: false,
    metrics: [
      {
        label: "יש לי מספיק זמן למנוחה.",
        value: "48.5 מתוך 100",
        helper: "14 משיבים",
        distribution: { green: 4, yellow: 6, red: 4 },
      },
    ],
    recommendations: [
      {
        title: "חלונות זמן מוגנים",
        body: "להגן על זמן הכנה.",
        source: "ISO 45003:2021",
        interventionIsDeterministic: false,
      },
    ],
  };
}

test("a map nothing is replacing carries no note", () => {
  assert.strictEqual(
    renderToStaticMarkup(<DashboardAiRefreshNotice refresh={undefined} />),
    "",
  );
});

test("a re-analysis in flight says the map is the previous one", () => {
  const html = renderToStaticMarkup(
    <DashboardAiRefreshNotice refresh={{ state: "running" }} />,
  );

  assert.match(html, /הניתוח האחרון שהושלם/);
  assert.match(html, /ניתוח מחדש פועל כעת/);
  // Not an alert: the map is readable and its numbers are real.
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /role="alert"/);
});

test("a re-analysis that failed says the map did not change", () => {
  const html = renderToStaticMarkup(
    <DashboardAiRefreshNotice
      refresh={{ state: "failed", failureCode: "provider_unavailable" }}
    />,
  );

  assert.match(html, /הניתוח האחרון שהושלם/);
  assert.match(html, /נכשל/);
  // The failure code belongs in a log. It names our internals, and it would be
  // the only English on a Hebrew screen.
  assert.doesNotMatch(html, /provider_unavailable/);
});

/*
 * What the screen says once it checks on its own.
 *
 * Three sentences for one situation, and the difference between them is the
 * instruction each carries: come back later, do nothing, or press the button.
 * A watching screen that still said "in a few minutes" would be asking the
 * manager to do the thing it just took over.
 */
test("a watching screen says the map updates by itself", () => {
  const html = renderToStaticMarkup(
    <DashboardAiRefreshNotice
      refresh={{ state: "running" }}
      watch={{ watching: true, gaveUp: false, arrived: false }}
    />,
  );

  assert.match(html, /תתעדכן מעצמה/);
  assert.doesNotMatch(html, /בתוך דקות ספורות/);
});

test("a screen that gave up says so instead of promising an update", () => {
  const html = renderToStaticMarkup(
    <DashboardAiRefreshNotice
      refresh={{ state: "running" }}
      watch={{ watching: false, gaveUp: true, arrived: false }}
    />,
  );

  assert.match(html, /הפסיק לבדוק מעצמו/);
  assert.doesNotMatch(html, /תתעדכן מעצמה/);
});

test("without a watch the wording is the one it always was", () => {
  // Server-rendered markup has no watch yet, and the old sentence is the
  // honest one there: nothing is checking until the browser takes over.
  const html = renderToStaticMarkup(
    <DashboardAiRefreshNotice refresh={{ state: "running" }} />,
  );

  assert.match(html, /בתוך דקות ספורות/);
});

test("a map that arrived while the manager waited says it arrived", () => {
  const html = renderToStaticMarkup(
    <DashboardAiArrivedNotice
      watch={{ watching: false, gaveUp: false, arrived: true }}
    />,
  );

  assert.match(html, /הניתוח הושלם/);
  assert.match(html, /role="status"/);
});

test("a map that was already there announces nothing", () => {
  // The notice explains a map that changed under the reader. A round opened
  // after its analysis finished changed nothing and gets no sentence.
  assert.strictEqual(
    renderToStaticMarkup(
      <DashboardAiArrivedNotice
        watch={{ watching: false, gaveUp: false, arrived: false }}
      />,
    ),
    "",
  );
  assert.strictEqual(
    renderToStaticMarkup(<DashboardAiArrivedNotice watch={undefined} />),
    "",
  );
});

/**
 * The three detail screens announce an arrival too.
 *
 * The standing notes — a re-run in flight, a partial map — live only on the
 * overview, because a sentence repeated on every screen is read on none. The
 * arrival is the exception, and this is the test that keeps it one: it reports
 * a change that happened in front of the reader, and the reader who waited on
 * a dimension screen is the one it is for. Without these the detail screens
 * would fill themselves in silently, which is the behaviour the whole feature
 * exists to end.
 */
test("a dimension, metrics or recommendations screen announces the map it watched arrive", () => {
  const arrived = { watching: false, gaveUp: false, arrived: true };
  const value = detailStone();

  for (const html of [
    renderToStaticMarkup(
      <DashboardDimensionDetail
        dimension={detailDimension}
        stone={value}
        roundId="round-1"
        organizationName="בית ספר"
        roundTitle="סבב אבחון"
        watch={arrived}
      />,
    ),
    renderToStaticMarkup(
      <DashboardMetricsStage
        dimension={detailDimension}
        stone={value}
        roundId="round-1"
        organizationName="בית ספר"
        roundTitle="סבב אבחון"
        watch={arrived}
      />,
    ),
    renderToStaticMarkup(
      <DashboardRecommendationsStage
        dimension={detailDimension}
        stone={value}
        roundId="round-1"
        organizationName="בית ספר"
        roundTitle="סבב אבחון"
        watch={arrived}
      />,
    ),
  ]) {
    assert.match(html, /הניתוח הושלם/);
  }
});

test("the detail screens stay silent about a map that was already there", () => {
  const html = renderToStaticMarkup(
    <DashboardDimensionDetail
      dimension={detailDimension}
      stone={detailStone()}
      roundId="round-1"
      organizationName="בית ספר"
      roundTitle="סבב אבחון"
    />,
  );

  assert.doesNotMatch(html, /הניתוח הושלם/);
});
