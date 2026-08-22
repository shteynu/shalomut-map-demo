import assert from "node:assert";
import { test } from "node:test";
import {
  breakdownRoute,
  isNewRoundParam,
  newRoundSetupRoute,
  readBreakdownQuestionParam,
  routeHrefForRound,
  resolveLoginRedirect,
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
  helpRoute,
  isMainNavItemActive,
  isPathWithin,
  mainNavItems,
  mainNavItemsForRound,
  navigationRoundId,
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

test("mainNavItems follows exact product workflow order: home, setup, surveyBuilder, round, dashboard, breakdown, goals", () => {
  const ids = mainNavItems.map((item) => item.id);
  // Goals come last because they come after the map in the work as well: the
  // school reads the picture, then decides what to do about it. The breakdown
  // sits between the two: it is a second reading of the same measurement, and
  // a school looks at the whole staff room before splitting it into groups.
  assert.deepStrictEqual(ids, [
    "home",
    "setup",
    "surveyBuilder",
    "round",
    "dashboard",
    "breakdown",
    "goals",
  ]);
});

test("the breakdown link carries the round but never the question", () => {
  assert.strictEqual(breakdownRoute("round-7"), "/breakdown?round=round-7");
  assert.strictEqual(
    breakdownRoute("round-7", "tenure"),
    "/breakdown?round=round-7&question=tenure",
  );
  assert.strictEqual(breakdownRoute(undefined, "tenure"), "/breakdown?question=tenure");

  // The header carries the round only: a question belongs to one round's
  // questionnaire, and following it to another round would ask for a question
  // that round does not have.
  assert.strictEqual(routeHrefForRound("breakdown", "round-7"), "/breakdown?round=round-7");
});

test("the breakdown screen reads its question the same way every screen reads its round", () => {
  assert.strictEqual(readBreakdownQuestionParam({ question: "tenure" }), "tenure");
  assert.strictEqual(readBreakdownQuestionParam({ question: ["a", "b"] }), "a");
  assert.strictEqual(readBreakdownQuestionParam({ question: "  " }), undefined);
  assert.strictEqual(readBreakdownQuestionParam({}), undefined);
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

test("the header carries the round to the screens that show one round's numbers", () => {
  const items = mainNavItemsForRound("round-7");
  const hrefById = Object.fromEntries(items.map((item) => [item.id, item.href]));

  assert.strictEqual(hrefById.home, "/?round=round-7");
  assert.strictEqual(hrefById.round, "/round?round=round-7");
  assert.strictEqual(hrefById.surveyBuilder, "/survey?round=round-7");
  assert.strictEqual(hrefById.dashboard, "/dashboard?round=round-7");
});

test("setup and goals stay outside the round context", () => {
  const hrefById = Object.fromEntries(
    mainNavItemsForRound("round-7").map((item) => [item.id, item.href]),
  );

  // Setup configures the round the school is working on rather than displaying
  // a past one, and goals belong to the school across rounds (ADR-018).
  assert.strictEqual(hrefById.setup, "/setup");
  assert.strictEqual(hrefById.goals, "/goals");
});

test("without a round the header is the plain navigation", () => {
  assert.deepStrictEqual(mainNavItemsForRound(), mainNavItems);
  assert.deepStrictEqual(mainNavItemsForRound(""), mainNavItems);
});

test("a navigation action opens the round the manager is reading", () => {
  assert.strictEqual(
    getNavigationAction("openDashboard", "round-7").href,
    "/dashboard?round=round-7",
  );
  assert.strictEqual(getNavigationAction("openDashboard").href, "/dashboard");
  // Setup is not about a past round, so it ignores one.
  assert.strictEqual(getNavigationAction("startSetup", "round-7").href, "/setup");
});

test("the login redirect keeps an in-application destination", () => {
  assert.strictEqual(resolveLoginRedirect("/round"), "/round");
  assert.strictEqual(resolveLoginRedirect("/dashboard?round=round-7"), "/dashboard?round=round-7");
});

test("the login redirect refuses a destination outside this application", () => {
  // The middleware only ever writes a pathname here, but the value reaches the
  // form through the query string, so the form cannot assume that. Each of
  // these is a host a browser would navigate to.
  assert.strictEqual(resolveLoginRedirect("https://example.com/"), "/");
  assert.strictEqual(resolveLoginRedirect("//example.com"), "/");
  assert.strictEqual(resolveLoginRedirect("/\\example.com"), "/");
  assert.strictEqual(resolveLoginRedirect("javascript:alert(1)"), "/");

  // Refused whole rather than trimmed down to the path inside it. Keeping
  // `/goals` out of `//example.com/goals` would be honouring the half of an
  // attacker's value that happens to be harmless, and it would make the
  // fallback depend on what the other host's path spelled.
  assert.strictEqual(resolveLoginRedirect("//example.com/goals"), "/");
  assert.strictEqual(resolveLoginRedirect("/\\example.com/goals"), "/");
});

/**
 * The string that was checked has to be the string that is navigated to.
 *
 * Browsers and the WHATWG URL parser drop ASCII tab, line feed and carriage
 * return from anywhere in a URL before parsing it, so a check on the first two
 * characters reads a value nobody else ever sees. Each candidate here passed
 * the old prefix rule and landed on `example.com`.
 */
test("the login redirect refuses a host smuggled past a prefix check", () => {
  for (const smuggled of [
    "/\n/example.com",
    "/\r/example.com",
    "/\t/example.com",
    "/\n\\example.com",
    "/\t\\example.com",
    "/\n/example.com/goals",
    "/\t\\example.com/goals",
  ]) {
    assert.strictEqual(
      resolveLoginRedirect(smuggled),
      "/",
      JSON.stringify(smuggled),
    );
  }
});

/**
 * Whatever is honoured is honoured in the parser's own words. A `Location`
 * header assembled from a raw candidate could carry a CR or an LF into the
 * response; one assembled from the parsed path cannot, because the parse is
 * where those characters stop existing.
 */
test("an honoured login redirect comes back parsed, not echoed", () => {
  assert.strictEqual(resolveLoginRedirect("/round\n"), "/round");
  assert.strictEqual(resolveLoginRedirect("/dash\tboard"), "/dashboard");
  assert.strictEqual(
    resolveLoginRedirect("/dashboard/../round?round=round-7#top"),
    "/round?round=round-7#top",
  );
  // A control character the parser encodes rather than strips stays inside the
  // path, where it names no host and reaches no header raw. It has to be in the
  // middle of the value: the parser removes leading and trailing C0 controls
  // outright, which is a third normalisation a prefix check would not have
  // known about either.
  assert.strictEqual(resolveLoginRedirect("/ro\u0001und"), "/ro%01und");
});

test("the login redirect falls back to home when there is nothing to honour", () => {
  assert.strictEqual(resolveLoginRedirect(null), "/");
  assert.strictEqual(resolveLoginRedirect(undefined), "/");
  assert.strictEqual(resolveLoginRedirect("   "), "/");
  // A relative reference resolves to a path inside the product, so the parser
  // would accept it. The middleware writes absolute paths and nothing else, and
  // a contract that holds by accident is one that stops holding quietly.
  assert.strictEqual(resolveLoginRedirect("round"), "/");
});

test("the header's round is the one in the URL, once it is a round", () => {
  assert.strictEqual(navigationRoundId("round-7"), "round-7");
  assert.strictEqual(navigationRoundId("  round-7  "), "round-7");
});

test("`round=new` is not a round the screen-wide links may carry", () => {
  // The setup screen uses `new` to say a round is being opened. Every other
  // screen looks the value up as an id, finds nothing and tells the manager the
  // round may have been deleted — while they are in the middle of creating it.
  assert.strictEqual(navigationRoundId("new"), undefined);
  assert.strictEqual(navigationRoundId(undefined), undefined);
  assert.strictEqual(navigationRoundId("   "), undefined);
});

test("opening a new round leaves the header pointing at the current round", () => {
  const hrefById = Object.fromEntries(
    mainNavItemsForRound(navigationRoundId("new")).map((item) => [
      item.id,
      item.href,
    ]),
  );

  assert.strictEqual(hrefById.home, "/");
  assert.strictEqual(hrefById.round, "/round");
  assert.strictEqual(hrefById.surveyBuilder, "/survey");
  assert.strictEqual(hrefById.dashboard, "/dashboard");
});

test("the guide is reachable but is not a step in the workflow", () => {
  assert.strictEqual(helpRoute(), routes.help);
  assert.strictEqual(helpRoute("help-privacy"), "/help#help-privacy");

  // The main navigation is what a manager does next, and reading an
  // explanation never is. A guide entry there would push a workflow step out
  // of sight on a narrow header.
  assert.ok(!mainNavItems.some((item) => item.href === routes.help));
});

test("the guide keeps the global header, unlike the map it explains", () => {
  // The dashboard renders headerless, which is why the locked map carries its
  // own link to the guide. The guide itself must not: it is the one screen a
  // manager arrives at without knowing where to go back to.
  assert.strictEqual(shouldHideGlobalHeader(routes.help), false);
  assert.strictEqual(isPathWithin("/help", routes.help), true);
});

test("the guide ignores a round, the way the goals screen does", () => {
  // It describes how the product behaves rather than one measurement, so a
  // round in the URL would promise a scoping that does not exist.
  assert.strictEqual(routeHrefForRound("help", "round-7"), routes.help);
  assert.strictEqual(routeHrefForRound("help"), routes.help);
});
