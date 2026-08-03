/**
 * Anonymous token for one questionnaire attempt.
 *
 * The submit endpoint rejects a second response carrying a token hash it has
 * already stored, which is what stops a double click or a retry after a failed
 * request from counting twice. That guard must therefore identify one filling
 * session — not the device: a token persisted per share code locked a browser
 * out of the round forever after a single answer, and an anonymous link has no
 * respondent identity that would justify such a lock.
 *
 * `restore` does not walk that back. The token it adopts comes from the draft
 * of the attempt currently being filled, which lives in `sessionStorage` and is
 * dropped on success, on decline and when another questionnaire is started. So
 * it still spans exactly one filling session — it just lets that session
 * survive a refresh, which is the case the old device-wide token got wrong in
 * the opposite direction.
 */
export interface SurveyAttemptTokenSource {
  /** The token of the current attempt, created on first use. */
  current(): string;
  /**
   * Adopts a token from a recovered draft. Reports whether it was accepted so
   * the caller can fall back to a fresh attempt instead of silently continuing
   * with one it believes it restored.
   */
  restore(token: unknown): boolean;
  /** Drops the current token so the next attempt submits as a new response. */
  reset(): void;
}

/**
 * Whether a value can serve as an attempt token.
 *
 * Deliberately not a UUID check. The token factory is injectable, so the shape
 * `crypto.randomUUID` happens to produce is not the contract, and a stricter
 * rule here would only be theatre: the token lives in the respondent's own
 * `sessionStorage`, and editing it buys nothing that clearing it does not
 * already buy — either way the next submission is simply treated as a new
 * attempt. What must be refused is a value that cannot be hashed into a
 * meaningful key at all.
 */
export function isAttemptToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_ATTEMPT_TOKEN_LENGTH
  );
}

const MAX_ATTEMPT_TOKEN_LENGTH = 200;

export function createAttemptTokenSource(
  createToken: () => string = () => crypto.randomUUID(),
): SurveyAttemptTokenSource {
  let token: string | null = null;

  return {
    current() {
      token ??= createToken();
      return token;
    },
    restore(candidate) {
      if (!isAttemptToken(candidate)) return false;

      token = candidate;
      return true;
    },
    reset() {
      token = null;
    },
  };
}

export async function hashAnonymousToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
