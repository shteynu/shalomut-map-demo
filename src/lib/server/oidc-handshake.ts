/**
 * What one sign-in has to remember while the browser is at the provider.
 *
 * It lives in an HttpOnly cookie scoped to the two routes that read it, for ten
 * minutes, and never anywhere else: a server-side store would be a table whose
 * only rows are half-finished sign-ins, and this runtime has no session
 * affinity to find such a row again.
 */
export const OIDC_HANDSHAKE_COOKIE = "shalomut_oidc";
export const OIDC_HANDSHAKE_PATH = "/api/auth/oidc";
export const OIDC_HANDSHAKE_TTL_SECONDS = 600;

export interface OidcHandshake {
  state: string;
  nonce: string;
  codeVerifier: string;
  /** Where the manager was going before the sign-in interrupted them. */
  next: string;
}

export function serializeHandshake(handshake: OidcHandshake): string {
  return JSON.stringify(handshake);
}

/**
 * The handshake, or `null` for anything that is not one. A cookie this runtime
 * did not write is not a handshake, and neither is one from a deploy whose
 * shape has changed.
 */
export function parseHandshake(value: string | undefined): OidcHandshake | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<OidcHandshake>;
    if (
      typeof parsed.state === "string" &&
      typeof parsed.nonce === "string" &&
      typeof parsed.codeVerifier === "string" &&
      typeof parsed.next === "string"
    ) {
      return parsed as OidcHandshake;
    }
  } catch {
    // A malformed cookie is a sign-in that cannot be completed, which is what
    // the caller does with `null` anyway.
  }

  return null;
}

/**
 * Every way a sign-in can end without a session, as codes the login screen
 * turns into sentences. They are deliberately coarse: a redirect carries them
 * in a URL the manager can read and paste, so none of them may describe whose
 * address it was or what the provider said about it.
 */
export type SignInErrorCode =
  | "provider_unconfigured"
  | "provider_refused"
  | "handshake_missing"
  | "state_mismatch"
  | "exchange_failed"
  | "invalid_token"
  | "unverified_email"
  | "not_invited"
  | "no_active_membership"
  | "rate_limited";
