/**
 * One more try before a respondent is told their answers did not go anywhere.
 *
 * The deployed endpoint loses the first submit after an idle period: the
 * request returns nothing at all, and the deployment's own function logs hold
 * **no invocation** for it, so it dies before any of this project's code runs.
 * A second press then works. That was reproduced twice on 2026-08-15 —
 * `net::ERR_EMPTY_RESPONSE` in a browser, and `status:000` after 12.8s from
 * `curl` with `redirects:0`, so the connection died before even the
 * trailing-slash redirect came back.
 *
 * Retrying is safe in both directions and neither direction is an assumption:
 * the server never saw the lost request, and if a request is ever lost *after*
 * it stored the response, the client already sends `anonymousTokenHash` and
 * `resolveSubmissionOutcome` reads `ALREADY_SUBMITTED` as a completion rather
 * than as an error.
 *
 * What this is not: a fix for the cause. The cause is upstream of the function
 * and this project cannot reach it. What it fixes is the person — five minutes
 * of answering should not end in a network error that one more press silently
 * repairs. It also earns its keep on a school's own wifi, which drops requests
 * for reasons no deployment setting will ever address.
 *
 * Only a *thrown* send is retried. An HTTP answer — including a refusal — is
 * the server having spoken, and every one of those is already a state
 * `resolveSubmissionOutcome` names.
 */

/** Waits before the second and third attempts. Short: a respondent is waiting. */
const DEFAULT_WAITS_MS = [1_000, 3_000];

export interface SubmissionRetryOptions<T> {
  /** Total attempts, including the first. */
  attempts?: number;
  /** How long to wait before attempt `n + 1`, in milliseconds. */
  waitsMs?: readonly number[];
  /** Seam for tests, so a retry costs no real time. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Called before each retry, never before the first attempt. The screen uses
   * it to say it is trying again rather than leaving one spinner spinning.
   */
  onRetry?: (attempt: number) => void;
  /** Seam for tests. Defaults to the identity of a thrown error. */
  send: () => Promise<T>;
}

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `send`, retrying only when it throws, and rethrows the last failure.
 *
 * The last error rather than the first: it is the one that describes the state
 * the respondent is actually in, and the earlier ones are already gone from the
 * screen by then.
 */
export async function sendWithRetry<T>({
  send,
  attempts = 3,
  waitsMs = DEFAULT_WAITS_MS,
  sleep = realSleep,
  onRetry,
}: SubmissionRetryOptions<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) {
      onRetry?.(attempt);
      // The last wait repeats if someone raises `attempts` without extending
      // the table, so a longer retry policy cannot silently become a tight loop.
      await sleep(waitsMs[attempt - 2] ?? waitsMs[waitsMs.length - 1] ?? 0);
    }

    try {
      return await send();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
