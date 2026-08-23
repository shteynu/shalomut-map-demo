export const AI_ANALYSIS_JOB_LEASE_MS = 90_000;
export const AI_ANALYSIS_JOB_MAX_ATTEMPTS = 3;

/**
 * How long takeable work may sit with nobody holding a lease before Core calls
 * the queue stalled.
 *
 * Ten minutes, and every part of that is a real wait rather than a margin for
 * comfort. The worker's idle poll widens to thirty seconds
 * (`AI_JOB_POLL_MAX_INTERVAL_SECONDS`), so a live consumer is late by that much
 * at worst. The rest is the free Render plan: an instance sleeps after fifteen
 * minutes without *inbound* traffic and its own polling is outbound, so a
 * sleeping consumer waits for the external uptime monitor's five-minute knock
 * and then about a minute of cold start before it can poll at all. Six and a
 * half minutes is therefore a legitimately slow start, not a fault, and the
 * threshold sits above it.
 *
 * It is not a queue-depth number. Ten rounds closing together leave nine of
 * them waiting for half an hour, and that is the queue working — which is why
 * the verdict also requires that no lease is alive. A consumer that is merely
 * busy is holding one.
 */
export const AI_ANALYSIS_QUEUE_STALL_AFTER_MS = 600_000;

export function isValidWorkerId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 120 &&
    /^[a-zA-Z0-9._:-]+$/u.test(value)
  );
}

export function isValidLeaseToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 200;
}

export function isValidFailureCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 64 &&
    /^[a-z0-9_]+$/u.test(value)
  );
}
