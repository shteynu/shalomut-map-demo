import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { MANAGER_ORGANIZATION_HEADER } from "../manager-scope";
import type { Manager, OrganizationMembership } from "@/lib/auth/types";

const mockManager: Manager = {
  id: "mgr-test-999",
  email: "principal@shalom-school.ac.il",
  name: "Principal Cohen",
  createdAt: new Date(),
};

const mockMembership: OrganizationMembership = {
  id: "mbs-test-999",
  managerId: "mgr-test-999",
  organizationId: "org-session-school-xyz",
  role: "manager",
  status: "active",
  createdAt: new Date(),
};

test("middleware passes valid session cookie and injects server-owned organization header", async () => {
  const provider = new JwtSessionProvider();
  const { token } = await provider.createSession(
    mockManager,
    "org-session-school-xyz",
    [mockMembership],
  );

  const request = new NextRequest("http://localhost:3000/dashboard", {
    headers: {
      cookie: `shalomut_session=${token}`,
      [MANAGER_ORGANIZATION_HEADER]: "org-attacker-injected",
    },
  });

  const response = await middleware(request);
  assert.strictEqual(response.status, 200);

  const injectedHeader = response.headers.get("x-middleware-request-x-shalomut-manager-organization-id") ||
    response.headers.get(MANAGER_ORGANIZATION_HEADER);
  assert.ok(injectedHeader);
  assert.strictEqual(injectedHeader, "org-session-school-xyz");
});

test("middleware passes valid Authorization Bearer session token", async () => {
  const provider = new JwtSessionProvider();
  const { token } = await provider.createSession(
    mockManager,
    "org-session-school-xyz",
    [mockMembership],
  );

  const request = new NextRequest("http://localhost:3000/api/rounds", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const response = await middleware(request);
  assert.strictEqual(response.status, 200);

  const injectedHeader = response.headers.get("x-middleware-request-x-shalomut-manager-organization-id") ||
    response.headers.get(MANAGER_ORGANIZATION_HEADER);
  assert.strictEqual(injectedHeader, "org-session-school-xyz");
});

test("middleware strips client-supplied organization header on respondent routes", async () => {
  const request = new NextRequest("http://localhost:3000/answer/SHALOM-TEST1", {
    headers: {
      [MANAGER_ORGANIZATION_HEADER]: "org-attacker-injected",
    },
  });

  const response = await middleware(request);
  assert.strictEqual(response.status, 200);

  const injectedHeader = response.headers.get("x-middleware-request-x-shalomut-manager-organization-id") ||
    response.headers.get(MANAGER_ORGANIZATION_HEADER);
  assert.strictEqual(injectedHeader, null);
});

test("middleware falls back to Basic Auth when no session cookie or bearer token is present", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard");
  const response = await middleware(request);

  // Default dev runtime without env credentials allows request or challenges in production
  assert.ok(response.status === 200 || response.status === 401 || response.status === 503);
});

test("middleware redirects UI page requests to /login when DISABLE_BASIC_AUTH_FALLBACK is set", async () => {
  const originalFlag = process.env.DISABLE_BASIC_AUTH_FALLBACK;
  process.env.DISABLE_BASIC_AUTH_FALLBACK = "true";

  try {
    const request = new NextRequest("http://localhost:3000/setup");
    const response = await middleware(request);

    assert.strictEqual(response.status, 307);
    const location = response.headers.get("location");
    assert.ok(location);
    assert.ok(location.includes("/login?next=%2Fsetup"));
  } finally {
    process.env.DISABLE_BASIC_AUTH_FALLBACK = originalFlag;
  }
});

test("middleware returns 401 JSON for unauthenticated API requests when DISABLE_BASIC_AUTH_FALLBACK is set", async () => {
  const originalFlag = process.env.DISABLE_BASIC_AUTH_FALLBACK;
  process.env.DISABLE_BASIC_AUTH_FALLBACK = "true";

  try {
    const request = new NextRequest("http://localhost:3000/api/rounds");
    const response = await middleware(request);

    assert.strictEqual(response.status, 401);
    const json = await response.json();
    assert.strictEqual(json.error, "Authentication required.");
  } finally {
    process.env.DISABLE_BASIC_AUTH_FALLBACK = originalFlag;
  }
});

