import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as startHandler } from "../start/route";
import { GET as callbackHandler } from "../callback/route";
import { InMemoryManagerRepository } from "@/lib/auth/domain-contract";
import { resetDiscoveryCacheForTests } from "@/lib/auth/identity-provider";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { overrideCoreRepositories } from "@/lib/composition-root";
import { SESSION_COOKIE_NAME } from "@/lib/server/session-auth";
import {
  OIDC_HANDSHAKE_COOKIE,
  serializeHandshake,
} from "@/lib/server/oidc-handshake";
import type { Manager, OrganizationMembership } from "@/lib/auth/types";

const ISSUER = "https://accounts.example.com";
const CLIENT_ID = "client-abc";
const TOKEN_ENDPOINT = "https://oauth2.example.com/token";

process.env.OIDC_ISSUER = ISSUER;
process.env.OIDC_CLIENT_ID = CLIENT_ID;
process.env.OIDC_CLIENT_SECRET = "secret-xyz";
process.env.OIDC_REDIRECT_URI =
  "http://localhost:3000/api/auth/oidc/callback";

const cohen: Manager = {
  id: "mgr-cohen",
  email: "principal@school.ac.il",
  name: "Principal Cohen",
  isPlatformAdministrator: false,
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

const cohenMembership: OrganizationMembership = {
  id: "mbs-1",
  managerId: cohen.id,
  organizationId: "org-school",
  role: "manager",
  status: "active",
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
};

function base64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function installProvider(email = "Principal@School.ac.il", nonce = "nonce-1") {
  resetDiscoveryCacheForTests();
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL) => {
    if (String(input).endsWith("/.well-known/openid-configuration")) {
      return new Response(
        JSON.stringify({
          authorization_endpoint: `${ISSUER}/o/oauth2/v2/auth`,
          token_endpoint: TOKEN_ENDPOINT,
        }),
        { status: 200 },
      );
    }

    const claims = {
      iss: ISSUER,
      aud: CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 300,
      nonce,
      email,
      email_verified: true,
      name: "Principal Cohen",
    };
    return new Response(
      JSON.stringify({
        id_token: `${base64Url({ alg: "RS256" })}.${base64Url(claims)}.sig`,
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  return () => {
    globalThis.fetch = original;
  };
}

function handshakeCookie(overrides: Record<string, string> = {}) {
  return `${OIDC_HANDSHAKE_COOKIE}=${encodeURIComponent(
    serializeHandshake({
      state: "state-1",
      nonce: "nonce-1",
      codeVerifier: "verifier-1",
      next: "/dashboard",
      ...overrides,
    }),
  )}`;
}

function callback(url: string, cookie?: string) {
  return new NextRequest(url, cookie ? { headers: { cookie } } : undefined);
}

function redirectTarget(response: Response) {
  return new URL(response.headers.get("location") ?? "", "http://localhost:3000");
}

test("the sign-in starts at the provider and remembers what it will check", async () => {
  const restore = installProvider();
  try {
    const response = await startHandler(
      new NextRequest("http://localhost:3000/api/auth/oidc/start?next=/goals"),
    );

    const target = redirectTarget(response);
    assert.strictEqual(target.origin + target.pathname, `${ISSUER}/o/oauth2/v2/auth`);

    const handshake = response.cookies.get(OIDC_HANDSHAKE_COOKIE);
    assert.ok(handshake);
    const remembered = JSON.parse(decodeURIComponent(handshake.value));
    assert.strictEqual(remembered.state, target.searchParams.get("state"));
    assert.strictEqual(remembered.nonce, target.searchParams.get("nonce"));
    assert.strictEqual(remembered.next, "/goals");
    assert.strictEqual(handshake.httpOnly, true);
  } finally {
    restore();
  }
});

test("a next that leaves the product is not a next", async () => {
  const restore = installProvider();
  try {
    const response = await startHandler(
      new NextRequest(
        "http://localhost:3000/api/auth/oidc/start?next=//evil.example.com",
      ),
    );

    const remembered = JSON.parse(
      decodeURIComponent(response.cookies.get(OIDC_HANDSHAKE_COOKIE)!.value),
    );
    assert.strictEqual(remembered.next, "/");
  } finally {
    restore();
  }
});

test("a verified address with a row becomes a session", async () => {
  overrideCoreRepositories({
    managerRepo: new InMemoryManagerRepository([cohen], [cohenMembership]),
  });
  const restore = installProvider();

  try {
    const response = await callbackHandler(
      callback(
        "http://localhost:3000/api/auth/oidc/callback?code=code-1&state=state-1",
        handshakeCookie(),
      ),
    );

    assert.strictEqual(redirectTarget(response).pathname, "/dashboard");

    const token = response.cookies.get(SESSION_COOKIE_NAME)?.value;
    assert.ok(token);
    const session = await new JwtSessionProvider().verifyToken(token);
    assert.strictEqual(session?.email, "principal@school.ac.il");
    assert.strictEqual(session?.activeOrganizationId, "org-school");
    assert.strictEqual(session?.isPlatformAdministrator, false);

    // The half-finished sign-in is not left in the browser.
    assert.strictEqual(response.cookies.get(OIDC_HANDSHAKE_COOKIE)?.value, "");
  } finally {
    restore();
  }
});

test("an address the provider verified but nobody invited gets no session", async () => {
  overrideCoreRepositories({ managerRepo: new InMemoryManagerRepository() });
  const restore = installProvider("stranger@elsewhere.ac.il");

  try {
    const response = await callbackHandler(
      callback(
        "http://localhost:3000/api/auth/oidc/callback?code=code-1&state=state-1",
        handshakeCookie(),
      ),
    );

    const target = redirectTarget(response);
    assert.strictEqual(target.pathname, "/login");
    assert.strictEqual(target.searchParams.get("error"), "not_invited");
    assert.strictEqual(response.cookies.get(SESSION_COOKIE_NAME), undefined);
  } finally {
    restore();
  }
});

test("an invited-but-not-active membership is refused as such", async () => {
  overrideCoreRepositories({
    managerRepo: new InMemoryManagerRepository(
      [cohen],
      [{ ...cohenMembership, status: "invited" }],
    ),
  });
  const restore = installProvider();

  try {
    const response = await callbackHandler(
      callback(
        "http://localhost:3000/api/auth/oidc/callback?code=code-1&state=state-1",
        handshakeCookie(),
      ),
    );

    assert.strictEqual(
      redirectTarget(response).searchParams.get("error"),
      "no_active_membership",
    );
  } finally {
    restore();
  }
});

test("a state that does not match the handshake is refused before anything is exchanged", async () => {
  const restore = installProvider();
  let exchanged = false;
  const stubbed = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL) => {
    if (String(input) === TOKEN_ENDPOINT) exchanged = true;
    return stubbed(input as never);
  }) as typeof fetch;

  try {
    const response = await callbackHandler(
      callback(
        "http://localhost:3000/api/auth/oidc/callback?code=code-1&state=somebody-elses",
        handshakeCookie(),
      ),
    );

    assert.strictEqual(
      redirectTarget(response).searchParams.get("error"),
      "state_mismatch",
    );
    assert.strictEqual(exchanged, false);
  } finally {
    restore();
  }
});

test("a callback with no handshake at all is refused", async () => {
  const restore = installProvider();
  try {
    const response = await callbackHandler(
      callback("http://localhost:3000/api/auth/oidc/callback?code=c&state=state-1"),
    );

    assert.strictEqual(
      redirectTarget(response).searchParams.get("error"),
      "handshake_missing",
    );
  } finally {
    restore();
  }
});

test("a token minted for another sign-in is refused", async () => {
  overrideCoreRepositories({
    managerRepo: new InMemoryManagerRepository([cohen], [cohenMembership]),
  });
  const restore = installProvider("principal@school.ac.il", "another-nonce");

  try {
    const response = await callbackHandler(
      callback(
        "http://localhost:3000/api/auth/oidc/callback?code=code-1&state=state-1",
        handshakeCookie(),
      ),
    );

    assert.strictEqual(
      redirectTarget(response).searchParams.get("error"),
      "invalid_token",
    );
    assert.strictEqual(response.cookies.get(SESSION_COOKIE_NAME), undefined);
  } finally {
    restore();
  }
});

test("the provider's own refusal comes back as a cancelled sign-in", async () => {
  const restore = installProvider();
  try {
    const response = await callbackHandler(
      callback(
        "http://localhost:3000/api/auth/oidc/callback?error=access_denied&state=state-1",
        handshakeCookie(),
      ),
    );

    assert.strictEqual(
      redirectTarget(response).searchParams.get("error"),
      "provider_refused",
    );
  } finally {
    restore();
  }
});

test("the callback is rate limited, and says so without a session", async () => {
  overrideCoreRepositories({
    managerRepo: new InMemoryManagerRepository([cohen], [cohenMembership]),
  });
  const restore = installProvider();

  try {
    const attempts = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      attempts.push(
        await callbackHandler(
          new NextRequest(
            "http://localhost:3000/api/auth/oidc/callback?code=code-1&state=state-1",
            {
              headers: {
                cookie: handshakeCookie(),
                "x-forwarded-for": "203.0.113.9",
              },
            },
          ),
        ),
      );
    }

    const last = attempts[attempts.length - 1];
    assert.strictEqual(
      redirectTarget(last).searchParams.get("error"),
      "rate_limited",
    );
    assert.strictEqual(last.cookies.get(SESSION_COOKIE_NAME), undefined);
  } finally {
    restore();
  }
});

test("where the provider is configured, the password door is closed", async () => {
  const { POST: loginHandler } = await import("../../login/route");

  const response = await loginHandler(
    new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@shalomut.edu.il",
        password: "admin123",
      }),
    }),
  );

  assert.strictEqual(response.status, 403);
  const body = await response.json();
  assert.strictEqual(body.reason, "PROVIDER_REQUIRED");
  assert.strictEqual(response.cookies.get(SESSION_COOKIE_NAME), undefined);
});
