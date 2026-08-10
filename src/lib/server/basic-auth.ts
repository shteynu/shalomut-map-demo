/**
 * Route classification for the manager gate.
 *
 * The HTTP Basic fallback was removed once application-level manager sessions
 * shipped: `middleware.ts` now redirects unauthenticated UI requests to
 * `/login` and answers unauthenticated API requests with `401 JSON`, so no
 * browser challenge is ever issued. What remains here is the classification of
 * the two route families that must stay reachable without a manager session.
 */

/**
 * Respondents answer anonymously through an unguessable share code and must
 * never be asked for manager credentials.
 */
export function isRespondentRoute(pathname: string) {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return (
    normalized === "/answer" ||
    normalized.startsWith("/answer/") ||
    normalized === "/api/survey" ||
    normalized.startsWith("/api/survey/")
  );
}

/**
 * The one route an uptime monitor is allowed to reach.
 *
 * `/api/health` was written to be read by nobody in particular — it echoes no
 * variable value and reports no database, provider or credential state — and it
 * still sat behind the manager gate, which meant the only thing watching this
 * product was nothing at all. A monitor cannot hold a session, and a monitor
 * that has to would be a second place to keep a credential.
 *
 * GET only. The endpoint has no other method, and a classifier that says
 * otherwise would be an open door the day one is added.
 */
export function isPublicOperationalRoute(pathname: string, method: string) {
  if (method !== "GET" && method !== "HEAD") return false;
  return pathname === "/api/health" || pathname === "/api/health/";
}

const AI_INSIGHTS_PATH = /^\/api\/rounds\/[^/]+\/ai-insights\/?$/;
const AI_ANALYSIS_RUN_WORKER_PATH =
  /^\/api\/ai-analysis-runs\/(?:claim|[^/]+\/(?:heartbeat|fail))\/?$/;

/**
 * Routes that the external AI service calls with their own shared secret. They
 * carry no browser session, so a manager redirect would only break them. The
 * GET on the AI insights path returns manager analytics and stays behind the
 * session gate.
 */
export function isMachineAuthenticatedRoute(pathname: string, method: string) {
  if (pathname === "/api/mcp" || pathname === "/api/mcp/") return true;
  return (
    method === "POST" &&
    (AI_INSIGHTS_PATH.test(pathname) ||
      AI_ANALYSIS_RUN_WORKER_PATH.test(pathname))
  );
}
