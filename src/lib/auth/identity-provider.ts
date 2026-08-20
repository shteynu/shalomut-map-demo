/**
 * Sign-in through an external identity provider.
 *
 * The owner decided on 2026-08-20 that the product stores no passwords: an
 * address is established by the provider, and this module is everything needed
 * to establish it. What the address is *allowed* to do is a separate question,
 * answered by `ManagerDirectoryService` against the manager rows.
 *
 * Nothing here is Google-specific. The provider is named by its issuer and the
 * endpoints are read from that issuer's discovery document, so any OpenID
 * Connect provider — a school's own Microsoft tenant, a future migration — is a
 * change of configuration rather than of code.
 */

export interface IdentityProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /**
   * Where the provider sends the browser back. Configured rather than derived
   * from the request, because the provider matches it against a fixed list and
   * a value taken from a `Host` header is a value an attacker can propose.
   */
  redirectUri: string;
}

interface ProviderEnvironment {
  OIDC_ISSUER?: string;
  OIDC_CLIENT_ID?: string;
  OIDC_CLIENT_SECRET?: string;
  OIDC_REDIRECT_URI?: string;
}

/**
 * The four variables, read in one place. Every function here takes an
 * environment so a test can hand it one, and this is what the running product
 * hands them — which also makes the list of variables greppable as a list
 * rather than as four scattered lookups.
 */
function currentEnvironment(): ProviderEnvironment {
  return {
    OIDC_ISSUER: process.env.OIDC_ISSUER,
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET,
    OIDC_REDIRECT_URI: process.env.OIDC_REDIRECT_URI,
  };
}

/**
 * The provider's configuration, or `null` when this runtime has none.
 *
 * All four values or none: a half-configured provider is the failure mode that
 * costs a day, because the login screen offers a door that cannot open. The
 * caller treats `null` as "this runtime still signs in the interim way".
 */
export function resolveIdentityProviderConfig(
  environment: ProviderEnvironment = currentEnvironment(),
): IdentityProviderConfig | null {
  const issuer = environment.OIDC_ISSUER?.trim().replace(/\/+$/, "");
  const clientId = environment.OIDC_CLIENT_ID?.trim();
  const clientSecret = environment.OIDC_CLIENT_SECRET?.trim();
  const redirectUri = environment.OIDC_REDIRECT_URI?.trim();

  if (!issuer || !clientId || !clientSecret || !redirectUri) return null;

  return { issuer, clientId, clientSecret, redirectUri };
}

export function isIdentityProviderConfigured(
  environment: ProviderEnvironment = currentEnvironment(),
): boolean {
  return resolveIdentityProviderConfig(environment) !== null;
}

/**
 * Which of the provider's configured values are missing, for a runtime that
 * set some of them. Named for the log line; it never reaches a response, and
 * it names variables rather than values.
 */
export function describeIdentityProviderGaps(
  environment: ProviderEnvironment = currentEnvironment(),
): string[] {
  const required: (keyof ProviderEnvironment)[] = [
    "OIDC_ISSUER",
    "OIDC_CLIENT_ID",
    "OIDC_CLIENT_SECRET",
    "OIDC_REDIRECT_URI",
  ];
  return required.filter((name) => !environment[name]?.trim());
}

export interface ProviderEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
}

const discoveryCache = new Map<string, ProviderEndpoints>();

/**
 * The provider's endpoints, read from its own discovery document and then
 * remembered.
 *
 * Hardcoding Google's two URLs would have been shorter and would have made the
 * issuer decorative — the first non-Google school would have found out at
 * sign-in time.
 */
export async function discoverEndpoints(
  config: IdentityProviderConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderEndpoints> {
  const cached = discoveryCache.get(config.issuer);
  if (cached) return cached;

  const response = await fetchImpl(
    `${config.issuer}/.well-known/openid-configuration`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(
      `the identity provider's discovery document could not be read (HTTP ${response.status})`,
    );
  }

  const document = (await response.json()) as {
    authorization_endpoint?: string;
    token_endpoint?: string;
  };
  if (!document.authorization_endpoint || !document.token_endpoint) {
    throw new Error(
      "the identity provider's discovery document names no authorization or token endpoint",
    );
  }

  const endpoints: ProviderEndpoints = {
    authorizationEndpoint: document.authorization_endpoint,
    tokenEndpoint: document.token_endpoint,
  };
  discoveryCache.set(config.issuer, endpoints);
  return endpoints;
}

/** Test seam: forgets what discovery returned. */
export function resetDiscoveryCacheForTests(): void {
  discoveryCache.clear();
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export interface AuthorizationRequest {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

/**
 * The redirect that starts a sign-in, and the three secrets the callback will
 * check it against.
 *
 * `state` answers "did this browser start this sign-in", `nonce` answers "is
 * this token about this sign-in", and the PKCE verifier answers "is the party
 * redeeming this code the one that asked for it". The caller keeps all three in
 * an HttpOnly cookie for the length of the round trip and nowhere else.
 */
export async function createAuthorizationRequest(
  config: IdentityProviderConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthorizationRequest> {
  const { authorizationEndpoint } = await discoverEndpoints(config, fetchImpl);

  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken();
  const challenge = base64Url(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(codeVerifier),
    ),
  );

  const url = new URL(authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  // `openid email profile` and nothing else. The product needs an address to
  // recognise a person and a name to greet them; a scope that reaches further
  // would be data this product has no use for and would still have to declare.
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return { url: url.toString(), state, nonce, codeVerifier };
}

export interface ProviderIdentity {
  email: string;
  name: string;
}

export class IdentityProviderError extends Error {
  constructor(
    message: string,
    /** A short, non-identifying reason safe to put in a redirect. */
    public readonly code: "exchange_failed" | "invalid_token" | "unverified_email",
  ) {
    super(message);
    this.name = "IdentityProviderError";
  }
}

interface IdTokenClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

function decodeIdTokenClaims(idToken: string): IdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new IdentityProviderError(
      "the identity token is not a JWT",
      "invalid_token",
    );
  }

  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    return JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(json, (character) => character.charCodeAt(0)),
      ),
    ) as IdTokenClaims;
  } catch {
    throw new IdentityProviderError(
      "the identity token's payload could not be read",
      "invalid_token",
    );
  }
}

/**
 * The address behind an authorization code.
 *
 * The identity token's signature is deliberately not verified, and that is the
 * one place this module departs from what a reader expects. It is what OpenID
 * Connect Core §3.1.3.7 allows for exactly this case: the token was fetched by
 * this server from the provider's own token endpoint over TLS, in a request
 * authenticated with the client secret, so the signature would be re-proving
 * the transport. What is checked instead is everything the transport cannot
 * say: that the issuer is the configured one, that the audience is this client,
 * that the token has not expired, and that the nonce is the one this sign-in
 * sent. The day a token arrives any other way — an implicit flow, a token
 * posted by a browser — this comment stops applying and JWKS verification is
 * required.
 */
export async function exchangeCodeForIdentity(
  config: IdentityProviderConfig,
  input: { code: string; codeVerifier: string; nonce: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderIdentity> {
  const { tokenEndpoint } = await discoverEndpoints(config, fetchImpl);

  const response = await fetchImpl(tokenEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: input.codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    throw new IdentityProviderError(
      `the identity provider refused the authorization code (HTTP ${response.status})`,
      "exchange_failed",
    );
  }

  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) {
    throw new IdentityProviderError(
      "the identity provider returned no identity token",
      "invalid_token",
    );
  }

  const claims = decodeIdTokenClaims(payload.id_token);

  // Google issues `https://accounts.google.com` while its discovery document is
  // served from the same host with the scheme spelled out; both spellings are
  // the same issuer and neither is a wildcard.
  const issuerMatches =
    claims.iss === config.issuer ||
    claims.iss === config.issuer.replace(/^https:\/\//, "");
  if (!issuerMatches) {
    throw new IdentityProviderError(
      "the identity token was issued by somebody else",
      "invalid_token",
    );
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(config.clientId)) {
    throw new IdentityProviderError(
      "the identity token was issued for a different client",
      "invalid_token",
    );
  }

  if (!claims.exp || claims.exp * 1000 <= Date.now()) {
    throw new IdentityProviderError(
      "the identity token has expired",
      "invalid_token",
    );
  }

  if (claims.nonce !== input.nonce) {
    throw new IdentityProviderError(
      "the identity token belongs to a different sign-in",
      "invalid_token",
    );
  }

  const email = claims.email?.trim().toLowerCase();
  if (!email) {
    throw new IdentityProviderError(
      "the identity token carries no address",
      "invalid_token",
    );
  }

  // An unverified address is somebody's claim to an address, not an address.
  // The provider says so explicitly; a provider that says nothing has already
  // verified it by its own rules.
  if (claims.email_verified === false) {
    throw new IdentityProviderError(
      "the identity provider has not verified this address",
      "unverified_email",
    );
  }

  return { email, name: claims.name?.trim() || email };
}
