import assert from "node:assert/strict";
import test from "node:test";
import {
  IdentityProviderError,
  createAuthorizationRequest,
  describeIdentityProviderGaps,
  exchangeCodeForIdentity,
  isIdentityProviderConfigured,
  resetDiscoveryCacheForTests,
  resolveIdentityProviderConfig,
} from "../identity-provider";

const config = {
  issuer: "https://accounts.example.com",
  clientId: "client-abc",
  clientSecret: "secret-xyz",
  redirectUri: "https://shalomut.example.com/api/auth/oidc/callback",
};

const environment = {
  OIDC_ISSUER: config.issuer,
  OIDC_CLIENT_ID: config.clientId,
  OIDC_CLIENT_SECRET: config.clientSecret,
  OIDC_REDIRECT_URI: config.redirectUri,
};

const discovery = {
  authorization_endpoint: "https://accounts.example.com/o/oauth2/v2/auth",
  token_endpoint: "https://oauth2.example.com/token",
};

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function idToken(claims: Record<string, unknown>): string {
  return `${base64Url({ alg: "RS256" })}.${base64Url(claims)}.signature`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: config.issuer,
    aud: config.clientId,
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: "nonce-1",
    email: "Principal@School.ac.il",
    email_verified: true,
    name: "Principal Cohen",
    ...overrides,
  };
}

/**
 * A provider that answers discovery once and the token endpoint with whatever
 * the test hands it. Every call is recorded, because what this module sends is
 * as much of the contract as what it accepts.
 */
function stubProvider(tokenResponse: {
  status?: number;
  body?: Record<string, unknown>;
}) {
  const calls: { url: string; body?: string }[] = [];

  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? String(init.body) : undefined });

    if (url.endsWith("/.well-known/openid-configuration")) {
      return new Response(JSON.stringify(discovery), { status: 200 });
    }

    return new Response(JSON.stringify(tokenResponse.body ?? {}), {
      status: tokenResponse.status ?? 200,
    });
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

test("all four variables or none: a half-configured provider is not one", () => {
  assert.deepStrictEqual(resolveIdentityProviderConfig(environment), config);
  assert.strictEqual(isIdentityProviderConfigured(environment), true);

  assert.strictEqual(
    resolveIdentityProviderConfig({ ...environment, OIDC_CLIENT_SECRET: "  " }),
    null,
  );
  assert.strictEqual(resolveIdentityProviderConfig({}), null);
  assert.deepStrictEqual(
    describeIdentityProviderGaps({ OIDC_ISSUER: config.issuer }),
    ["OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_REDIRECT_URI"],
  );
});

test("a trailing slash on the issuer is the same issuer", () => {
  assert.strictEqual(
    resolveIdentityProviderConfig({
      ...environment,
      OIDC_ISSUER: "https://accounts.example.com/",
    })?.issuer,
    config.issuer,
  );
});

test("the authorization request carries PKCE, a state and a nonce", async () => {
  resetDiscoveryCacheForTests();
  const { fetchImpl } = stubProvider({});

  const request = await createAuthorizationRequest(config, fetchImpl);
  const url = new URL(request.url);

  assert.strictEqual(url.origin + url.pathname, discovery.authorization_endpoint);
  assert.strictEqual(url.searchParams.get("response_type"), "code");
  assert.strictEqual(url.searchParams.get("client_id"), config.clientId);
  assert.strictEqual(url.searchParams.get("redirect_uri"), config.redirectUri);
  assert.strictEqual(url.searchParams.get("scope"), "openid email profile");
  assert.strictEqual(url.searchParams.get("state"), request.state);
  assert.strictEqual(url.searchParams.get("nonce"), request.nonce);
  assert.strictEqual(url.searchParams.get("code_challenge_method"), "S256");

  const expected = Buffer.from(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(request.codeVerifier),
    ),
  ).toString("base64url");
  assert.strictEqual(url.searchParams.get("code_challenge"), expected);
  assert.notStrictEqual(request.state, request.nonce);
});

test("the endpoints are read from the provider's own document, once", async () => {
  resetDiscoveryCacheForTests();
  const { fetchImpl, calls } = stubProvider({});

  await createAuthorizationRequest(config, fetchImpl);
  await createAuthorizationRequest(config, fetchImpl);

  const discoveryCalls = calls.filter((call) =>
    call.url.endsWith("/.well-known/openid-configuration"),
  );
  assert.strictEqual(discoveryCalls.length, 1);
});

test("an address comes back lowercased, with the code and the verifier sent", async () => {
  resetDiscoveryCacheForTests();
  const { fetchImpl, calls } = stubProvider({
    body: { id_token: idToken(validClaims()) },
  });

  const identity = await exchangeCodeForIdentity(
    config,
    { code: "code-1", codeVerifier: "verifier-1", nonce: "nonce-1" },
    fetchImpl,
  );

  assert.deepStrictEqual(identity, {
    email: "principal@school.ac.il",
    name: "Principal Cohen",
  });

  const token = calls.find((call) => call.url === discovery.token_endpoint);
  const sent = new URLSearchParams(token?.body ?? "");
  assert.strictEqual(sent.get("grant_type"), "authorization_code");
  assert.strictEqual(sent.get("code"), "code-1");
  assert.strictEqual(sent.get("code_verifier"), "verifier-1");
  assert.strictEqual(sent.get("client_secret"), config.clientSecret);
  assert.strictEqual(sent.get("redirect_uri"), config.redirectUri);
});

test("an address with no name is greeted by its address", async () => {
  resetDiscoveryCacheForTests();
  const { fetchImpl } = stubProvider({
    body: { id_token: idToken(validClaims({ name: "   " })) },
  });

  const identity = await exchangeCodeForIdentity(
    config,
    { code: "code-1", codeVerifier: "verifier-1", nonce: "nonce-1" },
    fetchImpl,
  );

  assert.strictEqual(identity.name, "principal@school.ac.il");
});

const refusals: [string, Record<string, unknown>, string][] = [
  ["another issuer", { iss: "https://accounts.attacker.example" }, "invalid_token"],
  ["another client", { aud: "client-somebody-else" }, "invalid_token"],
  ["an expired token", { exp: Math.floor(Date.now() / 1000) - 1 }, "invalid_token"],
  ["another sign-in's nonce", { nonce: "nonce-2" }, "invalid_token"],
  ["no address at all", { email: undefined }, "invalid_token"],
  ["an unverified address", { email_verified: false }, "unverified_email"],
];

for (const [description, overrides, code] of refusals) {
  test(`a token with ${description} is refused`, async () => {
    resetDiscoveryCacheForTests();
    const { fetchImpl } = stubProvider({
      body: { id_token: idToken(validClaims(overrides)) },
    });

    await assert.rejects(
      () =>
        exchangeCodeForIdentity(
          config,
          { code: "code-1", codeVerifier: "verifier-1", nonce: "nonce-1" },
          fetchImpl,
        ),
      (error: unknown) =>
        error instanceof IdentityProviderError && error.code === code,
    );
  });
}

test("a provider that refuses the code is not a sign-in", async () => {
  resetDiscoveryCacheForTests();
  const { fetchImpl } = stubProvider({ status: 400, body: { error: "invalid_grant" } });

  await assert.rejects(
    () =>
      exchangeCodeForIdentity(
        config,
        { code: "code-1", codeVerifier: "verifier-1", nonce: "nonce-1" },
        fetchImpl,
      ),
    (error: unknown) =>
      error instanceof IdentityProviderError && error.code === "exchange_failed",
  );
});

test("a token response without an identity token is not a sign-in", async () => {
  resetDiscoveryCacheForTests();
  const { fetchImpl } = stubProvider({ body: { access_token: "at" } });

  await assert.rejects(
    () =>
      exchangeCodeForIdentity(
        config,
        { code: "code-1", codeVerifier: "verifier-1", nonce: "nonce-1" },
        fetchImpl,
      ),
    (error: unknown) =>
      error instanceof IdentityProviderError && error.code === "invalid_token",
  );
});

test("a discovery document naming no endpoints stops the sign-in there", async () => {
  resetDiscoveryCacheForTests();
  const fetchImpl = (async () =>
    new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;

  await assert.rejects(
    () => createAuthorizationRequest(config, fetchImpl),
    /names no authorization or token endpoint/,
  );
});
