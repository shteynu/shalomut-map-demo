/**
 * How long a manager session lives, and how long it may be kept alive.
 *
 * Two numbers rather than one, because they answer two different questions. The
 * first is how long a session survives without the manager doing anything —
 * which is also how long a revoked person keeps reading, since the token is the
 * only thing the middleware consults. The second is how long a session may be
 * renewed at all, which is the ceiling on a stolen cookie and on a browser tab
 * left open over a weekend.
 *
 * Owner decision 2026-08-21, taken against how a manager actually works:
 * reading a map and writing goals is not a keyboard-busy task, so the window
 * had to be long enough that nobody is signed out mid-reading, and short enough
 * that revoking access means something inside the hour. Fifteen minutes, under
 * a twelve-hour cap.
 */

/**
 * The sliding window. A token expires this far after it was minted, and every
 * renewal mints a new one — so this is both the idle-logout timer and the
 * longest a revocation can go unnoticed.
 */
export const SESSION_TTL_SECONDS = 15 * 60;

/**
 * The ceiling. Measured from the sign-in that started the session and carried
 * across every renewal unchanged, so no amount of activity extends it.
 */
export const SESSION_ABSOLUTE_LIFETIME_SECONDS = 12 * 60 * 60;

/**
 * How long before expiry the client stops waiting and renews.
 *
 * A third of the window: late enough that a working manager causes at most a
 * few renewals an hour — each one a database read from Washington to Seoul —
 * and early enough that a slow renewal has two more chances before the session
 * it was refreshing is gone.
 */
export const SESSION_RENEWAL_INTERVAL_SECONDS = 5 * 60;

/**
 * When a session that starts now must end, whatever happens in between.
 */
export function absoluteDeadlineFrom(issuedAt: Date): Date {
  return new Date(
    issuedAt.getTime() + SESSION_ABSOLUTE_LIFETIME_SECONDS * 1000,
  );
}

/**
 * The lifetime a token minted now may claim, which is the window except at the
 * very end of a session's life.
 *
 * Without this a renewal in the last quarter of an hour would mint a token
 * outliving the deadline it is supposed to respect, and the deadline would only
 * be enforced by the check that reads it — belt and braces, at the cost of one
 * subtraction.
 */
export function ttlSecondsWithin(
  absoluteExpiresAt: Date,
  now: Date = new Date(),
): number {
  const remaining = Math.floor(
    (absoluteExpiresAt.getTime() - now.getTime()) / 1000,
  );
  return Math.max(0, Math.min(SESSION_TTL_SECONDS, remaining));
}
