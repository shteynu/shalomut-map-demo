export const AI_ANALYSIS_JOB_LEASE_MS = 90_000;
export const AI_ANALYSIS_JOB_MAX_ATTEMPTS = 3;

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
