/**
 * Which commit this deployment is actually running.
 *
 * The AI service has answered this on its own `/health` since it had one, and
 * Core has not, so "is the deployed code the code I just pushed?" could be
 * asked of one half of the system and not the other. Nothing else can answer
 * it from outside: the Vercel dashboard can, but that is a sign-in and a
 * different surface, and a deployment alias moving is exactly the moment
 * nobody wants to be reading a dashboard.
 *
 * Kept apart from the route so the rule below can be tested directly. What
 * makes this safe to publish is not the variable it reads but the shape it
 * insists on, and a rule that decides what leaves a public endpoint is worth
 * asserting on its own rather than through an environment variable and an
 * HTTP response.
 */

/**
 * The variable Vercel sets on every deployment. Named here rather than read
 * inline so the test and the endpoint cannot drift onto two different names.
 */
export const DEPLOYMENT_COMMIT_ENV = 'VERCEL_GIT_COMMIT_SHA';

/** What an unreadable or absent commit reports. Never an empty string: a blank
 * value reads as "no commit" rather than "this deployment cannot say", and the
 * two are different answers. */
export const UNKNOWN_DEPLOYMENT_COMMIT = 'unknown';

/** How much of the SHA is published, matching what the AI service reports and
 * what `git log --oneline` prints, so the two can be compared by eye. */
const SHORT_COMMIT_LENGTH = 7;

/**
 * A full Git SHA-1 and nothing else: exactly forty hex digits.
 *
 * The narrowness is the point. `/api/health` is anonymous and its own contract
 * is that no variable's value is echoed — `resolveProducedAnalyticsContractVersion`
 * says so in as many words, because echoing whatever a variable happens to
 * hold is how a misplaced secret gets published. A commit SHA is the one value
 * worth breaking that rule for, and the rule is kept anyway by publishing only
 * a value that is provably a commit SHA and could be nothing else.
 *
 * Exactly forty, not "at least": this repository generates its shared secrets
 * with `openssl rand -hex 32`, which is sixty-four hex characters and would
 * pass a lower bound. A secret has no business in this variable, but the
 * endpoint should not be the thing that assumes so.
 */
const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;

/**
 * The short commit this deployment runs, or `unknown`.
 *
 * Unknown is the honest answer in three different situations and deliberately
 * does not distinguish them: running locally, where no deployment variable
 * exists; a host that names the variable something else; and a value that is
 * not a commit SHA. A caller comparing this against `git rev-parse` learns the
 * same thing from all three — this deployment cannot prove what it runs — and
 * separating them would only describe the deployment's own configuration to
 * an anonymous caller.
 */
export function resolveDeploymentCommit(
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env[DEPLOYMENT_COMMIT_ENV]?.trim();

  if (!value || !FULL_COMMIT_SHA.test(value)) {
    return UNKNOWN_DEPLOYMENT_COMMIT;
  }

  return value.slice(0, SHORT_COMMIT_LENGTH).toLowerCase();
}
