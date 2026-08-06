export const routes = {
  home: "/",
  login: "/login",
  setup: "/setup",
  round: "/round",
  surveyBuilder: "/survey",
  respondentSurvey: "/answer",
  dashboard: "/dashboard",
  goals: "/goals",
} as const;

export type MainNavItemId =
  | "home"
  | "setup"
  | "round"
  | "surveyBuilder"
  | "dashboard"
  | "goals";

export type AppRouteId = keyof typeof routes;

export type MainNavItem = {
  id: MainNavItemId;
  href: string;
  label: string;
};

export type RouteMetadata = {
  id: AppRouteId;
  href: string;
  navLabel: string;
  actionTitle: string;
  actionBody?: string;
  actionGlow?: string;
};

export const routeMetadata = {
  home: {
    id: "home",
    href: routes.home,
    navLabel: "מרכז ניהול",
    actionTitle: "מרכז ניהול",
  },
  login: {
    id: "login",
    href: routes.login,
    navLabel: "התחברות",
    actionTitle: "התחברות למערכת",
  },
  setup: {
    id: "setup",
    href: routes.setup,
    navLabel: "הגדרת סבב אבחון",
    actionTitle: "הגדרת סבב אבחון",
    actionBody: "פתיחת רבעון, הזנת נתוני רקע וקביעת סף פרטיות להצגת תוצאות.",
    actionGlow: "var(--pastel-peach)",
  },
  round: {
    id: "round",
    href: routes.round,
    navLabel: "מעקב סבב אבחון",
    actionTitle: "הפצת לינק אנונימי",
    actionBody: "מעקב אחרי מספר התשובות בלבד, בלי שמות ובלי זיהוי אישי.",
    actionGlow: "var(--pastel-sky)",
  },
  surveyBuilder: {
    id: "surveyBuilder",
    href: routes.surveyBuilder,
    navLabel: "בניית שאלון",
    actionTitle: "בניית שאלון",
    actionBody: "עריכת מבנה השאלון, שאלות חובה וקישור משיבים חיצוני לדוגמה.",
    actionGlow: "var(--pastel-lilac)",
  },
  respondentSurvey: {
    id: "respondentSurvey",
    href: routes.respondentSurvey,
    navLabel: "שאלון משיבים",
    actionTitle: "תצוגת המשיב",
  },
  dashboard: {
    id: "dashboard",
    href: routes.dashboard,
    navLabel: "מפת השלומות",
    actionTitle: "צפייה במפת השלומות",
    actionBody: "אבחון צבעוני, פירוט מילולי, מטרות ויעדים לשיחה ניהולית.",
    actionGlow: "var(--pastel-green)",
  },
  goals: {
    id: "goals",
    href: routes.goals,
    // The screen is about the school rather than about one round, so it sits
    // beside the map rather than inside it.
    navLabel: "מעקב יעדים",
    actionTitle: "מעקב יעדים",
    actionBody: "כל היעדים שנבחרו, מכל סבבי האבחון, עם המצב שלהם.",
    actionGlow: "var(--pastel-peach)",
  },
} satisfies Record<AppRouteId, RouteMetadata>;

const mainNavOrder: MainNavItemId[] = [
  "home",
  "setup",
  "surveyBuilder",
  "round",
  "dashboard",
  "goals",
];

export const mainNavItems: MainNavItem[] = mainNavOrder.map((id) => ({
  id,
  href: routeMetadata[id].href,
  label: routeMetadata[id].navLabel,
}));

export const homeActionRouteIds = [
  "setup",
  "surveyBuilder",
  "round",
  "dashboard",
  "goals",
] as const;

export const navigationLabels = {
  productName: "מפת השלומות",
  productSubtitle: "אבחון שלומות ארגונית",
  homeAria: "מפת השלומות - דף הבית",
  backToMain: "חזרה למסך הראשי",
  backToMap: "חזרה למפת השלומות",
  highlightedMetrics: "נתונים בולטים",
  goals: "מטרות ויעדים",
} as const;

export type NavigationActionId =
  | "startSetup"
  | "openDashboard"
  | "editSurvey"
  | "manageSurvey"
  | "trackRound"
  | "distributeSurvey"
  | "openRespondentSurvey"
  | "backToMain"
  | "backToMap";

export type NavigationAction = {
  id: NavigationActionId;
  href: string;
  label: string;
  target: AppRouteId;
};

const navigationActionDefinitions: Record<NavigationActionId, { target: AppRouteId; label: string }> = {
  startSetup: { target: "setup", label: "התחלת סבב אבחון" },
  openDashboard: { target: "dashboard", label: "פתיחת המפה" },
  editSurvey: { target: "surveyBuilder", label: "עריכת שאלון" },
  manageSurvey: { target: "surveyBuilder", label: "ניהול שאלון" },
  trackRound: { target: "round", label: "מעבר למעקב סבב אבחון" },
  distributeSurvey: { target: "surveyBuilder", label: "המשך לבניית שאלון" },
  openRespondentSurvey: { target: "respondentSurvey", label: "פתיחת קישור המשיבים" },
  backToMain: { target: "home", label: navigationLabels.backToMain },
  backToMap: { target: "dashboard", label: navigationLabels.backToMap },
};

export function getNavigationAction(
  id: NavigationActionId,
  roundId?: string,
): NavigationAction {
  const action = navigationActionDefinitions[id];

  return {
    id,
    href: routeHrefForRound(action.target, roundId),
    label: action.label,
    target: action.target,
  };
}

const headerlessRoutes = [routes.dashboard, routes.respondentSurvey, routes.login] as const;

export const appRoutePrefixes = [routes.setup, routes.round, routes.surveyBuilder, routes.dashboard] as const;

function trimTrailingSlash(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function isPathWithin(pathname: string | null | undefined, route: string) {
  if (!pathname) {
    return false;
  }

  const normalizedPathname = trimTrailingSlash(pathname);
  const normalizedRoute = trimTrailingSlash(route);

  if (normalizedRoute === routes.home) {
    return normalizedPathname === routes.home;
  }

  return normalizedPathname === normalizedRoute || normalizedPathname.startsWith(`${normalizedRoute}/`);
}

export function isMainNavItemActive(pathname: string | null | undefined, href: string) {
  return isPathWithin(pathname, href);
}

export function shouldHideGlobalHeader(pathname: string | null | undefined) {
  return headerlessRoutes.some((route) => isPathWithin(pathname, route));
}

/**
 * Which round a dashboard screen is about, carried in the URL.
 *
 * Every dashboard link takes the selected round with it. Dropping the
 * parameter on any hop would land the manager back on the active round midway
 * through reading an older one, which looks like the data changed rather than
 * the round.
 */
export const DASHBOARD_ROUND_PARAM = "round";

/**
 * The value that asks the setup screen for a round that does not exist yet.
 *
 * It shares the `round` parameter rather than adding a second one so a screen
 * has one question to answer — which round is this about — and "a new one" is
 * one of the answers. No round id can collide with it: ids are uuids.
 */
export const NEW_ROUND_PARAM = "new";

/**
 * Read the round out of a page's search params. A repeated parameter is not a
 * link this app produces, so the first value wins rather than the request
 * being refused.
 */
export function readRoundParam(searchParams: {
  round?: string | string[];
}): string | undefined {
  const value = Array.isArray(searchParams.round)
    ? searchParams.round[0]
    : searchParams.round;

  return value?.trim() || undefined;
}

/** Whether the screen was asked for a round that does not exist yet. */
export function isNewRoundParam(value: string | undefined): boolean {
  return value === NEW_ROUND_PARAM;
}

function withRound(path: string, roundId?: string) {
  if (!roundId) {
    return path;
  }

  return `${path}?${DASHBOARD_ROUND_PARAM}=${encodeURIComponent(roundId)}`;
}

export function homeRoute(roundId?: string) {
  return withRound(routes.home, roundId);
}

export function dashboardMapRoute(roundId?: string) {
  return withRound(routes.dashboard, roundId);
}

export function setupRoute(roundId?: string) {
  return withRound(routes.setup, roundId);
}

/** The setup screen, asked for a round the school does not have yet. */
export function newRoundSetupRoute() {
  return withRound(routes.setup, NEW_ROUND_PARAM);
}

export function surveyBuilderRoute(roundId?: string) {
  return withRound(routes.surveyBuilder, roundId);
}

export function roundTrackingRoute(roundId?: string) {
  return withRound(routes.round, roundId);
}

export function dashboardDimensionRoute(dimensionId: string, roundId?: string) {
  return withRound(`${routes.dashboard}/${dimensionId}`, roundId);
}

export function dashboardDimensionMetricsRoute(
  dimensionId: string,
  roundId?: string,
) {
  return withRound(`${routes.dashboard}/${dimensionId}/metrics`, roundId);
}

export function dashboardDimensionRecommendationsRoute(
  dimensionId: string,
  roundId?: string,
) {
  return withRound(
    `${routes.dashboard}/${dimensionId}/recommendations`,
    roundId,
  );
}

/**
 * The screens that are about one round, and how each one names it.
 *
 * A manager reading last semester's round has to be able to move between the
 * screens without losing it. Everything reachable from the header that shows a
 * round's own numbers is here; `setup` is not, because it configures the round
 * the school is working on rather than displaying a past one, and `goals` is
 * not, because goals belong to the school across rounds (ADR-018).
 */
const roundScopedRoutes: Partial<
  Record<AppRouteId, (roundId?: string) => string>
> = {
  home: homeRoute,
  round: roundTrackingRoute,
  surveyBuilder: surveyBuilderRoute,
  dashboard: dashboardMapRoute,
};

/**
 * Where a route leads for a manager reading a particular round. Routes that
 * are not about one round ignore the round, so a caller can pass it
 * everywhere without deciding which screens care.
 */
export function routeHrefForRound(id: AppRouteId, roundId?: string): string {
  const toRoute = roundScopedRoutes[id];

  return toRoute ? toRoute(roundId) : routeMetadata[id].href;
}

/**
 * The main navigation, told which round the manager is reading. Without a
 * round it is the plain navigation, which is what a manager on the school's
 * current round gets: the parameter would only repeat the default.
 */
export function mainNavItemsForRound(roundId?: string): MainNavItem[] {
  if (!roundId) {
    return mainNavItems;
  }

  return mainNavItems.map((item) => ({
    ...item,
    href: routeHrefForRound(item.id, roundId),
  }));
}

export function respondentSurveyRoute(shareCode: string) {
  return `${routes.respondentSurvey}/${encodeURIComponent(shareCode)}`;
}

export type DashboardActionId = "dimensionMetrics" | "dimensionRecommendations" | "dashboardMap";

export type DashboardNavigationAction = {
  id: DashboardActionId;
  href: string;
  label: string;
  variant: "primary" | "secondary";
};

export function getDashboardDetailActions(
  dimensionId: string,
  roundId?: string,
): DashboardNavigationAction[] {
  return [
    {
      id: "dimensionMetrics",
      href: dashboardDimensionMetricsRoute(dimensionId, roundId),
      label: navigationLabels.highlightedMetrics,
      variant: "primary",
    },
    {
      id: "dashboardMap",
      href: dashboardMapRoute(roundId),
      label: navigationLabels.backToMap,
      variant: "secondary",
    },
  ];
}

export function getDashboardMetricsActions(
  dimensionId: string,
  roundId?: string,
): DashboardNavigationAction[] {
  return [
    {
      id: "dimensionRecommendations",
      href: dashboardDimensionRecommendationsRoute(dimensionId, roundId),
      label: navigationLabels.goals,
      variant: "primary",
    },
    {
      id: "dashboardMap",
      href: dashboardMapRoute(roundId),
      label: navigationLabels.backToMap,
      variant: "secondary",
    },
  ];
}

export function getDashboardRecommendationsActions(
  roundId?: string,
): DashboardNavigationAction[] {
  return [
    {
      id: "dashboardMap",
      href: dashboardMapRoute(roundId),
      label: navigationLabels.backToMap,
      variant: "secondary",
    },
  ];
}
