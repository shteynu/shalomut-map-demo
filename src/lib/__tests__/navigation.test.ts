import assert from "node:assert";
import { test } from "node:test";
import {
  isNewRoundParam,
  newRoundSetupRoute,
  roundTrackingRoute,
  setupRoute,
  surveyBuilderRoute,
  dashboardMapRoute,
  readRoundParam,
  dashboardDimensionMetricsRoute,
  dashboardDimensionRecommendationsRoute,
  dashboardDimensionRoute,
  getDashboardDetailActions,
  getDashboardMetricsActions,
  getDashboardRecommendationsActions,
  getNavigationAction,
  isMainNavItemActive,
  isPathWithin,
  mainNavItems,
  respondentSurveyRoute,
  routes,
  shouldHideGlobalHeader,
} from "../navigation";

test("isPathWithin correctly matches routes and nested subroutes", () => {
  assert.strictEqual(isPathWithin("/", "/"), true);
  assert.strictEqual(isPathWithin("/setup", "/setup"), true);
  assert.strictEqual(isPathWithin("/setup/substep", "/setup"), true);
  assert.strictEqual(isPathWithin("/dashboard/social-resource", "/dashboard"), true);
  assert.strictEqual(isPathWithin("/round", "/setup"), false);
});

test("shouldHideGlobalHeader returns true for headerless routes (dashboard, respondent survey)", () => {
  assert.strictEqual(shouldHideGlobalHeader("/dashboard"), true);
  assert.strictEqual(shouldHideGlobalHeader("/dashboard/social-resource"), true);
  assert.strictEqual(shouldHideGlobalHeader("/answer/SHALOM-1234"), true);
  assert.strictEqual(shouldHideGlobalHeader("/answer/SHALOM-1234/"), true);

  assert.strictEqual(shouldHideGlobalHeader("/"), false);
  assert.strictEqual(shouldHideGlobalHeader("/setup"), false);
  assert.strictEqual(shouldHideGlobalHeader("/round"), false);
  assert.strictEqual(shouldHideGlobalHeader("/survey"), false);
});

test("isMainNavItemActive identifies active navigation items", () => {
  assert.strictEqual(isMainNavItemActive("/setup", routes.setup), true);
  assert.strictEqual(isMainNavItemActive("/round", routes.round), true);
  assert.strictEqual(isMainNavItemActive("/dashboard", routes.dashboard), true);
  assert.strictEqual(isMainNavItemActive("/survey", routes.surveyBuilder), true);
  assert.strictEqual(respondentSurveyRoute("SHALOM-1234"), "/answer/SHALOM-1234");
});

test("dashboardDimensionRoute helpers generate expected paths", () => {
  assert.strictEqual(dashboardDimensionRoute("social-resource"), "/dashboard/social-resource");
  assert.strictEqual(
    dashboardDimensionMetricsRoute("social-resource"),
    "/dashboard/social-resource/metrics",
  );
  assert.strictEqual(
    dashboardDimensionRecommendationsRoute("social-resource"),
    "/dashboard/social-resource/recommendations",
  );
});

test("getNavigationAction returns action metadata correctly", () => {
  const startSetup = getNavigationAction("startSetup");
  assert.strictEqual(startSetup.href, "/setup");
  assert.strictEqual(startSetup.target, "setup");

  const openDashboard = getNavigationAction("openDashboard");
  assert.strictEqual(openDashboard.href, "/dashboard");
  assert.strictEqual(openDashboard.target, "dashboard");
});

test("getDashboardDetailActions and metrics actions return correct links", () => {
  const detailActions = getDashboardDetailActions("balance");
  assert.strictEqual(detailActions.length, 2);
  assert.strictEqual(detailActions[0].href, "/dashboard/balance/metrics");
  assert.strictEqual(detailActions[1].href, "/dashboard");

  const metricsActions = getDashboardMetricsActions("balance");
  assert.strictEqual(metricsActions[0].href, "/dashboard/balance/recommendations");
  assert.strictEqual(metricsActions[1].href, "/dashboard");

  const recActions = getDashboardRecommendationsActions();
  assert.strictEqual(recActions[0].href, "/dashboard");
});

test("mainNavItems follows exact product workflow order: home, setup, surveyBuilder, round, dashboard", () => {
  const ids = mainNavItems.map((item) => item.id);
  assert.deepStrictEqual(ids, ["home", "setup", "surveyBuilder", "round", "dashboard"]);
});

test("every dashboard link carries the round it is about", () => {
  assert.strictEqual(dashboardMapRoute("round-7"), "/dashboard?round=round-7");
  assert.strictEqual(
    dashboardDimensionRoute("balance", "round-7"),
    "/dashboard/balance?round=round-7",
  );
  assert.strictEqual(
    dashboardDimensionMetricsRoute("balance", "round-7"),
    "/dashboard/balance/metrics?round=round-7",
  );
  assert.strictEqual(
    dashboardDimensionRecommendationsRoute("balance", "round-7"),
    "/dashboard/balance/recommendations?round=round-7",
  );

  const detailActions = getDashboardDetailActions("balance", "round-7");
  assert.strictEqual(detailActions[0].href, "/dashboard/balance/metrics?round=round-7");
  assert.strictEqual(detailActions[1].href, "/dashboard?round=round-7");

  const metricsActions = getDashboardMetricsActions("balance", "round-7");
  assert.strictEqual(
    metricsActions[0].href,
    "/dashboard/balance/recommendations?round=round-7",
  );
  assert.strictEqual(metricsActions[1].href, "/dashboard?round=round-7");

  assert.strictEqual(
    getDashboardRecommendationsActions("round-7")[0].href,
    "/dashboard?round=round-7",
  );
});

test("a round id that needs escaping does not break out of the query string", () => {
  assert.strictEqual(
    dashboardDimensionRoute("balance", "a b&c=d"),
    "/dashboard/balance?round=a%20b%26c%3Dd",
  );
});

test("without a round the dashboard links stay plain, which is the active round", () => {
  assert.strictEqual(dashboardMapRoute(), "/dashboard");
  assert.strictEqual(dashboardDimensionRoute("balance"), "/dashboard/balance");
});

test("readRoundParam trims, ignores an empty value and takes the first of a repeat", () => {
  assert.strictEqual(readRoundParam({ round: "round-7" }), "round-7");
  assert.strictEqual(readRoundParam({ round: "  round-7  " }), "round-7");
  assert.strictEqual(readRoundParam({ round: "   " }), undefined);
  assert.strictEqual(readRoundParam({}), undefined);
  assert.strictEqual(readRoundParam({ round: ["first", "second"] }), "first");
});

test("the manager routes take a round the same way the dashboard does", () => {
  assert.strictEqual(setupRoute("round-7"), "/setup?round=round-7");
  assert.strictEqual(surveyBuilderRoute("round-7"), "/survey?round=round-7");
  assert.strictEqual(roundTrackingRoute("round-7"), "/round?round=round-7");
  assert.strictEqual(setupRoute(), "/setup");
});

test("a round that does not exist yet is asked for by name, not by id", () => {
  assert.strictEqual(newRoundSetupRoute(), "/setup?round=new");
  assert.strictEqual(isNewRoundParam(readRoundParam({ round: "new" })), true);
  assert.strictEqual(isNewRoundParam(readRoundParam({ round: " new " })), true);
  assert.strictEqual(isNewRoundParam(readRoundParam({ round: "round-7" })), false);
  assert.strictEqual(isNewRoundParam(readRoundParam({})), false);
});
