import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";
import { JwtSessionProvider } from "@/lib/auth/jwt-session-provider";
import { MANAGER_ORGANIZATION_HEADER } from "../manager-scope";
import type { Manager, OrganizationMembership } from "@/lib/auth/types";

/**
 * `next` declares `NODE_ENV` as a readonly literal union, so a test that swaps
 * it needs a mutable view of the very same object.
 */
const mutableEnv = process.env as Record<string, string | undefined>;

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

test("middleware redirects unauthenticated UI page requests to /login without Basic Auth challenge header", async () => {
  const request = new NextRequest("http://localhost:3000/dashboard");
  const response = await middleware(request);

  assert.strictEqual(response.status, 307);
  const location = response.headers.get("location");
  assert.ok(location?.includes("/login?next=%2Fdashboard"));
  assert.strictEqual(response.headers.get("www-authenticate"), null);
});

test("middleware returns 401 JSON for unauthenticated API requests without Basic Auth challenge header", async () => {
  const request = new NextRequest("http://localhost:3000/api/rounds");
  const response = await middleware(request);

  assert.strictEqual(response.status, 401);
  assert.strictEqual(await response.json().then((d) => d.error), "Authentication required.");
  assert.strictEqual(response.headers.get("www-authenticate"), null);
});

test("middleware allows unauthenticated access to /login and /login/ trailing slash paths", async () => {
  const req1 = new NextRequest("http://localhost:3000/login");
  const res1 = await middleware(req1);
  assert.strictEqual(res1.status, 200);

  const req2 = new NextRequest("http://localhost:3000/login/");
  const res2 = await middleware(req2);
  assert.strictEqual(res2.status, 200);
});

test("middleware and respondent routes stay functional when SESSION_SECRET is missing in deployed runtime", async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origVercelEnv = process.env.VERCEL_ENV;
  const origSecret = process.env.SESSION_SECRET;

  mutableEnv.NODE_ENV = "production";
  process.env.VERCEL_ENV = "production";
  delete process.env.SESSION_SECRET;

  try {
    const respondentReq = new NextRequest("http://localhost:3000/answer/SHALOM-TEST1");
    const respondentRes = await middleware(respondentReq);
    assert.strictEqual(respondentRes.status, 200);

    const loginReq = new NextRequest("http://localhost:3000/login/");
    const loginRes = await middleware(loginReq);
    assert.strictEqual(loginRes.status, 200);

    const mcpReq = new NextRequest("http://localhost:3000/api/mcp", { method: "POST" });
    const mcpRes = await middleware(mcpReq);
    assert.strictEqual(mcpRes.status, 200);
  } finally {
    mutableEnv.NODE_ENV = origNodeEnv;
    process.env.VERCEL_ENV = origVercelEnv;
    if (origSecret !== undefined) {
      process.env.SESSION_SECRET = origSecret;
    }
  }
});
