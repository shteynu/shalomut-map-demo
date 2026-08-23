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
  return (
    pathname === "/api/health" ||
    pathname === "/api/health/" ||
    /*
     * The queue's liveness verdict, and it is public for the same reason and
     * with the same discipline: a free uptime monitor cannot hold a session or
     * send a header, and a detector nobody can watch is the failure it was
     * built to end. It publishes a word and a status code — the depth and the
     * wait stay behind the shared secret on `/api/ai-analysis-runs/queue`.
     */
    pathname === "/api/health/ai-queue" ||
    pathname === "/api/health/ai-queue/" ||
    /*
     * The operational counters' verdict, public on the same terms: a word, a
     * list of breached threshold ids and a status code. The counts and the
     * ratios behind them stay behind the shared secret on `/api/observability`.
     */
    pathname === "/api/health/observability" ||
    pathname === "/api/health/observability/"
  );
}

const AI_INSIGHTS_PATH = /^\/api\/rounds\/[^/]+\/ai-insights\/?$/;
const AI_ANALYSIS_RUN_WORKER_PATH =
  /^\/api\/ai-analysis-runs\/(?:claim|[^/]+\/(?:heartbeat|fail))\/?$/;
/**
 * The queue's numbers, read by an operator rather than written by a worker —
 * so it is a `GET` and it is named apart from the three paths above rather
 * than folded into their expression. Widening that regex to both methods would
 * have opened `claim`, `heartbeat` and `fail` to a `GET` as well, which is a
 * larger change than this endpoint asked for.
 */
const AI_ANALYSIS_RUN_QUEUE_PATH = /^\/api\/ai-analysis-runs\/queue\/?$/;

/**
 * The counters' numbers, read by an operator with the same shared secret and
 * for the same reason: a monitor watches the public verdict, a person reads
 * this. Named apart for the reason the queue's path is — folding it into an
 * expression that also matches worker `POST` paths widens those instead.
 */
const OBSERVABILITY_PATH = /^\/api\/observability\/?$/;

/**
 * Routes that the external AI service calls with their own shared secret. They
 * carry no browser session, so a manager redirect would only break them. The
 * GET on the AI insights path returns manager analytics and stays behind the
 * session gate.
 */
export function isMachineAuthenticatedRoute(pathname: string, method: string) {
  if (pathname === "/api/mcp" || pathname === "/api/mcp/") return true;
  if (
    (method === "GET" || method === "HEAD") &&
    (AI_ANALYSIS_RUN_QUEUE_PATH.test(pathname) ||
      OBSERVABILITY_PATH.test(pathname))
  ) {
    return true;
  }
  return (
    method === "POST" &&
    (AI_INSIGHTS_PATH.test(pathname) ||
      AI_ANALYSIS_RUN_WORKER_PATH.test(pathname))
  );
}
