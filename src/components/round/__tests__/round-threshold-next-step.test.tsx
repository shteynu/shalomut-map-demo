import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardInsightsDto } from "@/lib/dashboard/dashboard-insights";
import { RoundControls } from "../round-controls";
import { RoundThresholdNextStepContent } from "../round-threshold-next-step";

const readyResult: DashboardInsightsDto = {
  roundId: "round-threshold-state",
  overallSummary: "סיכום ארגוני מוכן.",
  overallSummaryIsDeterministic: false,
  stones: {},
  dimensionsWithoutInterpretation: [],
  gapsByReason: {
    provider_unavailable: [],
    validation_rejected: [],
    unstated: [],
  },
  dimensionsWithDeterministicSummary: [],
};

const lockedResult: DashboardInsightsDto = {
  roundId: "round-threshold-state",
  overallSummary: "",
  overallSummaryIsDeterministic: false,
  stones: {},
  dimensionsWithoutInterpretation: [],
  gapsByReason: {
    provider_unavailable: [],
    validation_rejected: [],
    unstated: [],
  },
  dimensionsWithDeterministicSummary: [],
};

function renderState(
  state: Parameters<typeof RoundThresholdNextStepContent>[0]["state"],
  responseCount = 10,
  isCollecting = true,
) {
  return renderToStaticMarkup(
    <RoundThresholdNextStepContent
      state={state}
      responseCount={responseCount}
      minimumResponses={10}
      isCollecting={isCollecting}
    />,
  );
}

test("round next step names the remaining responses and where the analysis comes from", () => {
  const html = renderState({ status: "below-threshold" }, 7);

  assert.match(html, /עוד 3 תשובות/);
  assert.match(html, /המפה נשארת נעולה/);
  // Closing is what asks for the analysis, and the band must not promise that
  // reaching the threshold is enough on its own.
  assert.match(html, /בסגירת הסבב/);
  assert.doesNotMatch(html, /אוטומטית/);
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
  assert.match(running, /הניתוח החל/);
  assert.doesNotMatch(running, /אוטומטית/);
  assert.match(running, /בתוך דקות ספורות/);
  assert.doesNotMatch(running, /להפעיל רענון/);
});

test("round next step links to a readable completed map", () => {
  const html = renderState({ status: "ready", value: readyResult });

  assert.match(html, /המפה מוכנה/);
  // The old copy told the manager closing was unnecessary, which stopped being
  // true when closing became the thing that produces the map.
  assert.doesNotMatch(html, /אין צורך לסגור/);
  assert.match(html, /href="\/dashboard"/);
});

test("round next step keeps question-level privacy locking explicit", () => {
  const html = renderState({ status: "locked", value: lockedResult });

  assert.match(html, /לפחות שאלה אחת/);
  assert.match(html, /נשארת נעולה/);
  assert.doesNotMatch(html, /המפה מוכנה/);
});

test("round next step gives a closed round without a map a recovery action", () => {
  const missing = renderState({ status: "not-found" }, 10, false);
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

test("an open round without a map is an ordinary state, not a fault to recover from", () => {
  // The same `not-found` the closed round treats as an anomaly. On a round
  // still collecting it is where every round is until it closes, so offering a
  // recovery button would make the ordinary case read as a failure.
  const html = renderState({ status: "not-found" }, 10, true);

  assert.match(html, /הסבב אוסף תשובות/);
  assert.match(html, /בסגירת הסבב/);
  assert.doesNotMatch(html, /href="#refresh-round-analysis"/);
  assert.doesNotMatch(html, /עדיין לא נוצר ניתוח/);
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

test("re-running is offered on a closed round and refused while one is still collecting", () => {
  const props = {
    roundId: "round-threshold-state",
    shareCode: "ROUND-STATE",
    responseCount: 10,
    expectedResponses: 24,
    minimumResponses: 10,
  } as const;

  const collecting = renderToStaticMarkup(
    <RoundControls {...props} status="active" />,
  );
  const closed = renderToStaticMarkup(
    <RoundControls {...props} status="closed" />,
  );

  assert.match(
    collecting,
    /id="refresh-round-analysis"[^>]*disabled/,
    "a round still collecting has not been analysed once yet, so there is nothing to re-run",
  );
  assert.doesNotMatch(closed, /id="refresh-round-analysis"[^>]*disabled/);
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
