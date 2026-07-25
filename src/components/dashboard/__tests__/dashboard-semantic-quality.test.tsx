import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { StoneMapResult } from "@/lib/ai-contract";
import { getDimensionById } from "@/lib/demo-data";
import {
  DashboardOverviewSummary,
} from "../dashboard-map-page";
import { getDisplayedMetrics } from "../dashboard-metrics-page";

function createReadyResult(summary: string): StoneMapResult {
  return {
    contractVersion: "2.0",
    roundId: "round-dashboard-summary",
    processedAt: "2026-07-26T12:00:00.000Z",
    isLocked: false,
    status: "success",
    overallPsychologicalSummary: summary,
  };
}

test("DashboardOverviewSummary renders the organization summary exactly once", () => {
  const summary =
    "הסיכום הארגוני נשען על כלל הממדים ומוצג פעם אחת בלבד במפת השלומות.";
  const html = renderToStaticMarkup(
    <DashboardOverviewSummary
      state={{ status: "ready", value: createReadyResult(summary) }}
      onRetry={() => undefined}
    />,
  );

  assert.strictEqual(html.split(summary).length - 1, 1);
  assert.match(html, /סיכום ארגוני/);
});

test("DashboardOverviewSummary localizes invalid or unavailable insight states", () => {
  const rawError = "provider-secret-error-must-not-render";
  const html = renderToStaticMarkup(
    <DashboardOverviewSummary
      state={{ status: "error", error: rawError }}
      onRetry={() => undefined}
    />,
  );

  assert.doesNotMatch(html, new RegExp(rawError));
  assert.match(html, /לא הצלחנו לטעון את הניתוח/);
});

test("getDisplayedMetrics forwards all three question metrics to the metrics screen", () => {
  const dimension = getDimensionById("balance");
  assert.ok(dimension);

  const questionMetrics = [
    { label: "שאלה ראשונה", value: "70 מתוך 100", helper: "12 משיבים" },
    { label: "שאלה שנייה", value: "60 מתוך 100", helper: "12 משיבים" },
    { label: "שאלה שלישית", value: "50 מתוך 100", helper: "12 משיבים" },
  ];

  assert.deepStrictEqual(
    getDisplayedMetrics({ ...dimension, metrics: questionMetrics }),
    questionMetrics,
  );
});
