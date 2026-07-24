import assert from "node:assert";
import { test } from "node:test";
import {
  dashboardDimensionMetricsRoute,
  dashboardDimensionRecommendationsRoute,
  dashboardDimensionRoute,
  getDashboardDetailActions,
  getDashboardMetricsActions,
  getDashboardRecommendationsActions,
  getNavigationAction,
  isMainNavItemActive,
  isPathWithin,
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
  assert.strictEqual(shouldHideGlobalHeader("/survey/dror-q1"), true);
  assert.strictEqual(shouldHideGlobalHeader("/survey/dror-q1/"), true);

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
