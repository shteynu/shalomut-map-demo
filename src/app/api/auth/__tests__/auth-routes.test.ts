import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST as loginHandler } from "../login/route";
import { POST as logoutHandler } from "../logout/route";
import { GET as meHandler } from "../me/route";
import { SESSION_COOKIE_NAME } from "@/lib/server/session-auth";

test("API Auth Routes: POST /api/auth/login sets shalomut_session cookie on valid credentials", async () => {
  const request = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@shalomut.edu.il",
      password: "admin123",
    }),
  });

  const response = await loginHandler(request);
  assert.strictEqual(response.status, 200);

  const json = await response.json();
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.session.email, "admin@shalomut.edu.il");
  assert.strictEqual(json.session.role, "admin");

  const setCookieHeader = response.headers.get("set-cookie");
  assert.ok(setCookieHeader);
  assert.ok(setCookieHeader.includes(SESSION_COOKIE_NAME));
});

test("API Auth Routes: POST /api/auth/login returns 401 on invalid credentials", async () => {
  const request = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@shalomut.edu.il",
      password: "wrong-password",
    }),
  });

  const response = await loginHandler(request);
  assert.strictEqual(response.status, 401);

  const json = await response.json();
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.reason, "INVALID_CREDENTIALS");
});

test("API Auth Routes: GET /api/auth/me returns authenticated status when session cookie is provided", async () => {
  const loginRequest = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@shalomut.edu.il",
      password: "admin123",
    }),
  });

  const loginResponse = await loginHandler(loginRequest);
  const cookieHeader = loginResponse.headers.get("set-cookie");
  assert.ok(cookieHeader);

  const tokenMatch = cookieHeader.match(/shalomut_session=([^;]+)/);
  assert.ok(tokenMatch);
  const token = tokenMatch[1];

  const meRequest = new NextRequest("http://localhost:3000/api/auth/me", {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  });

  const meResponse = await meHandler(meRequest);
  assert.strictEqual(meResponse.status, 200);

  const meJson = await meResponse.json();
  assert.strictEqual(meJson.authenticated, true);
  assert.strictEqual(meJson.session.email, "admin@shalomut.edu.il");
  assert.strictEqual(meJson.session.role, "admin");
});

test("API Auth Routes: POST /api/auth/logout clears shalomut_session cookie", async () => {
  const response = await logoutHandler();
  assert.strictEqual(response.status, 200);

  const setCookieHeader = response.headers.get("set-cookie");
  assert.ok(setCookieHeader);
  assert.ok(setCookieHeader.includes(`${SESSION_COOKIE_NAME}=;`));
  assert.ok(setCookieHeader.includes("Max-Age=0"));
});
