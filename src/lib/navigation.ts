export const routes = {
  home: "/",
  setup: "/setup",
  round: "/round",
  surveyBuilder: "/survey",
  respondentSurvey: "/survey/dror-q1/",
  dashboard: "/dashboard",
} as const;

export type MainNavItemId = "home" | "setup" | "round" | "surveyBuilder" | "dashboard";

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
} satisfies Record<AppRouteId, RouteMetadata>;

const mainNavOrder: MainNavItemId[] = ["home", "setup", "round", "surveyBuilder", "dashboard"];

export const mainNavItems: MainNavItem[] = mainNavOrder.map((id) => ({
  id,
  href: routeMetadata[id].href,
  label: routeMetadata[id].navLabel,
}));

export const homeActionRouteIds = ["setup", "round", "surveyBuilder", "dashboard"] as const;

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
  distributeSurvey: { target: "round", label: "מעבר להפצת שאלון" },
  openRespondentSurvey: { target: "respondentSurvey", label: "פתיחת קישור המשיבים" },
  backToMain: { target: "home", label: navigationLabels.backToMain },
  backToMap: { target: "dashboard", label: navigationLabels.backToMap },
};

export function getNavigationAction(id: NavigationActionId): NavigationAction {
  const action = navigationActionDefinitions[id];

  return {
    id,
    href: routeMetadata[action.target].href,
    label: action.label,
    target: action.target,
  };
}

const headerlessRoutes = [routes.dashboard, routes.respondentSurvey] as const;

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

export function dashboardDimensionRoute(dimensionId: string) {
  return `${routes.dashboard}/${dimensionId}`;
}

export function dashboardDimensionMetricsRoute(dimensionId: string) {
  return `${dashboardDimensionRoute(dimensionId)}/metrics`;
}

export function dashboardDimensionRecommendationsRoute(dimensionId: string) {
  return `${dashboardDimensionRoute(dimensionId)}/recommendations`;
}

export type DashboardActionId = "dimensionMetrics" | "dimensionRecommendations" | "dashboardMap";

export type DashboardNavigationAction = {
  id: DashboardActionId;
  href: string;
  label: string;
  variant: "primary" | "secondary";
};

export function getDashboardDetailActions(dimensionId: string): DashboardNavigationAction[] {
  return [
    {
      id: "dimensionMetrics",
      href: dashboardDimensionMetricsRoute(dimensionId),
      label: navigationLabels.highlightedMetrics,
      variant: "primary",
    },
    {
      id: "dashboardMap",
      href: routes.dashboard,
      label: navigationLabels.backToMap,
      variant: "secondary",
    },
  ];
}

export function getDashboardMetricsActions(dimensionId: string): DashboardNavigationAction[] {
  return [
    {
      id: "dimensionRecommendations",
      href: dashboardDimensionRecommendationsRoute(dimensionId),
      label: navigationLabels.goals,
      variant: "primary",
    },
    {
      id: "dashboardMap",
      href: routes.dashboard,
      label: navigationLabels.backToMap,
      variant: "secondary",
    },
  ];
}

export function getDashboardRecommendationsActions(): DashboardNavigationAction[] {
  return [
    {
      id: "dashboardMap",
      href: routes.dashboard,
      label: navigationLabels.backToMap,
      variant: "secondary",
    },
  ];
}
