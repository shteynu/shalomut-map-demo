import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardInsightsDto } from "@/lib/dashboard/dashboard-insights";
import { RoundControls } from "../round-controls";
import { RoundThresholdNextStepContent } from "../round-threshold-next-step";

const readyResult: DashboardInsightsDto = {
  roundId: "round-threshold-state",
  overallSummary: "סיכום ארגוני מוכן.",
  stones: {},
  dimensionsWithoutInterpretation: [],
  gapsByReason: {
    provider_unavailable: [],
    validation_rejected: [],
    unstated: [],
  },
};

const lockedResult: DashboardInsightsDto = {
  roundId: "round-threshold-state",
  overallSummary: "",
  stones: {},
  dimensionsWithoutInterpretation: [],
  gapsByReason: {
    provider_unavailable: [],
    validation_rejected: [],
    unstated: [],
  },
};

function renderState(
  state: Parameters<typeof RoundThresholdNextStepContent>[0]["state"],
  responseCount = 10,
) {
  return renderToStaticMarkup(
    <RoundThresholdNextStepContent
      state={state}
      responseCount={responseCount}
      minimumResponses={10}
    />,
  );
}

test("round next step names the remaining responses and automatic threshold action", () => {
  const html = renderState({ status: "below-threshold" }, 7);

  assert.match(html, /עוד 3 תשובות/);
  assert.match(html, /המפה נשארת נעולה/);
  assert.match(html, /הניתוח יתחיל אוטומטית/);
  assert.doesNotMatch(html, /סגירת סבב/);
});

test("round next step uses singular Hebrew for the final missing response", () => {
  const html = renderState({ status: "below-threshold" }, 9);

  assert.match(html, /עוד תשובה אחת/);
  assert.doesNotMatch(html, /עוד 1 תשובות/);
});

test("round next step distinguishes checking and active analysis", () => {
  const checking = renderState({ status: "loading" });
  const running = renderState({ status: "running" });

  assert.match(checking, /בודקים את מצב הניתוח/);
  assert.match(checking, /aria-live="polite"/);
  assert.match(checking, /<h2 id="round-analysis-next-step-title">/);
  assert.match(running, /הניתוח התחיל אוטומטית/);
  assert.match(running, /בתוך דקות ספורות/);
  assert.doesNotMatch(running, /להפעיל רענון/);
});

test("round next step links to a readable completed map", () => {
  const html = renderState({ status: "ready", value: readyResult });

  assert.match(html, /המפה מוכנה/);
  assert.match(html, /אין צורך לסגור את הסבב/);
  assert.match(html, /href="\/dashboard"/);
});

test("round next step keeps question-level privacy locking explicit", () => {
  const html = renderState({ status: "locked", value: lockedResult });

  assert.match(html, /לפחות שאלה אחת/);
  assert.match(html, /נשארת נעולה/);
  assert.doesNotMatch(html, /המפה מוכנה/);
});

test("round next step gives missing and failed analysis a localized recovery action", () => {
  const missing = renderState({ status: "not-found" });
  const failed = renderState({
    status: "error",
    error: "provider-secret-must-not-render",
  });

  for (const html of [missing, failed]) {
    assert.match(html, /href="#refresh-round-analysis"/);
    assert.match(html, /רענון ניתוח/);
  }
  assert.match(missing, /עדיין לא נוצר ניתוח/);
  assert.match(failed, /התשובות שנאספו נשמרו/);
  assert.doesNotMatch(failed, /provider-secret-must-not-render/);
});

test("round controls expose the recovery target named by the next-step link", () => {
  const html = renderToStaticMarkup(
    <RoundControls
      roundId="round-threshold-state"
      shareCode="ROUND-STATE"
      responseCount={10}
      expectedResponses={24}
      minimumResponses={10}
      status="active"
    />,
  );

  assert.match(html, /id="refresh-round-analysis"/);
  assert.match(html, />רענון ניתוח</);
});

test("the map link opens the round the band is about, not the newest one", () => {
  const html = renderToStaticMarkup(
    <RoundThresholdNextStepContent
      state={{ status: "ready", value: readyResult }}
      responseCount={10}
      minimumResponses={10}
      roundId="round-previous"
    />,
  );

  assert.match(html, /href="\/dashboard\?round=round-previous"/);
});
