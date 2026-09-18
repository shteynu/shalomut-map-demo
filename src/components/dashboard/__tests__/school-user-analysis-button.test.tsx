import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardInsightsDto } from "@/lib/dashboard/dashboard-insights";
import { DashboardAiInsightsState } from "../dashboard-ai-insights-state";
import { DashboardOverviewSummary } from "../dashboard-map-page";

/**
 * A school user reads the analysis and does not order one (owner decision,
 * 2026-08-23, ADR-042). `POST /api/rounds/:roundId/trigger-ai` answers 403 to
 * the `manager` role, and this is the screen keeping the same promise.
 *
 * The button used to appear on all four dashboard screens for anybody who was
 * looking, because the only thing gating it was whether the screen knew its
 * round id — which it always does. Pressing it earned the school user a 403
 * rendered as "שירות הניתוח אינו זמין כרגע", a sentence about the provider
 * blamed for a decision about the reader.
 *
 * The «בדיקה חוזרת» / «ניסיון נוסף» buttons are asserted present on purpose:
 * re-reading the round is a read, so it stays for both roles, and a fix that
 * removed the whole tail of these states would pass a button-shaped assertion
 * while taking the school user's only way to refresh the screen.
 */
const ROUND_ID = "round-school-user-analysis";

const START_NOW = /יצירת ניתוח עכשיו/;
const RUN_AGAIN = /הפעלת ניתוח מחדש/;

function insightsState(
  state: Parameters<typeof DashboardAiInsightsState>[0]["state"],
  mayAct: boolean,
) {
  return renderToStaticMarkup(
    <DashboardAiInsightsState
      state={state}
      onRetry={() => undefined}
      roundId={ROUND_ID}
      mayAct={mayAct}
    />,
  );
}

test("a school user is offered no way to create the missing analysis", () => {
  const html = insightsState({ status: "not-found" }, false);

  assert.doesNotMatch(html, START_NOW);
  // The state still has to explain itself, and re-reading it is a read.
  assert.match(html, /הניתוח עדיין לא נוצר/);
  assert.match(html, /בדיקה חוזרת/);
});

test("a school user is offered no way to re-run a failed analysis", () => {
  const html = insightsState(
    { status: "error", error: "provider timed out" },
    false,
  );

  assert.doesNotMatch(html, RUN_AGAIN);
  assert.match(html, /שירות הניתוח אינו זמין כרגע/);
  assert.match(html, /ניסיון נוסף/);
});

test("an administrator on the same two states still gets the button", () => {
  // The negative control: if the button disappeared for everybody, the two
  // assertions above would pass while the product was broken.
  const missing = insightsState({ status: "not-found" }, true);
  const failed = insightsState(
    { status: "error", error: "provider timed out" },
    true,
  );

  assert.match(missing, START_NOW);
  assert.match(failed, RUN_AGAIN);
});

test("the re-check on a running analysis belongs to both roles", () => {
  // Reading the round again writes nothing, so it is not an administrator's.
  const schoolUser = insightsState({ status: "running" }, false);

  assert.match(schoolUser, /הניתוח בעבודה/);
  assert.match(schoolUser, /בדיקה חוזרת/);
  assert.doesNotMatch(schoolUser, START_NOW);
  assert.doesNotMatch(schoolUser, RUN_AGAIN);
});

/**
 * The map screen reaches the same states through its own summary component,
 * including one it constructs itself: a ready analysis whose organization
 * summary is missing is turned into an `error` state right there, and that
 * path used to hand the school user the button too.
 */
function readyWithoutSummary(): DashboardInsightsDto {
  return {
    roundId: ROUND_ID,
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
}

test("the map screen's summary offers a school user no analysis button", () => {
  const failed = renderToStaticMarkup(
    <DashboardOverviewSummary
      state={{ status: "error", error: "provider timed out" }}
      onRetry={() => undefined}
      roundId={ROUND_ID}
      mayAct={false}
    />,
  );
  const missingSummary = renderToStaticMarkup(
    <DashboardOverviewSummary
      state={{ status: "ready", value: readyWithoutSummary() }}
      onRetry={() => undefined}
      roundId={ROUND_ID}
      mayAct={false}
    />,
  );

  assert.doesNotMatch(failed, RUN_AGAIN);
  assert.doesNotMatch(missingSummary, RUN_AGAIN);
  assert.match(failed, /שירות הניתוח אינו זמין כרגע/);
});

test("the map screen's summary keeps the button for an administrator", () => {
  const html = renderToStaticMarkup(
    <DashboardOverviewSummary
      state={{ status: "error", error: "provider timed out" }}
      onRetry={() => undefined}
      roundId={ROUND_ID}
      mayAct
    />,
  );

  assert.match(html, RUN_AGAIN);
});
