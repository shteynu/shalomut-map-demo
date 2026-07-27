/**
 * Anonymous token for one questionnaire attempt.
 *
 * The submit endpoint rejects a second response carrying a token hash it has
 * already stored, which is what stops a double click or a retry after a failed
 * request from counting twice. That guard must therefore identify one filling
 * session — not the device: a token persisted per share code locked a browser
 * out of the round forever after a single answer, and an anonymous link has no
 * respondent identity that would justify such a lock.
 */
export interface SurveyAttemptTokenSource {
  /** The token of the current attempt, created on first use. */
  current(): string;
  /** Drops the current token so the next attempt submits as a new response. */
  reset(): void;
}

export function createAttemptTokenSource(
  createToken: () => string = () => crypto.randomUUID(),
): SurveyAttemptTokenSource {
  let token: string | null = null;

  return {
    current() {
      token ??= createToken();
      return token;
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
