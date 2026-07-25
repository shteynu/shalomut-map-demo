import assert from "node:assert/strict";
import test from "node:test";
import { decideBasicAuth } from "../basic-auth";

const CONFIGURED = {
  BASIC_AUTH_USER: "manager",
  BASIC_AUTH_PASSWORD: "correct-horse",
  NODE_ENV: "production",
  VERCEL_ENV: "production",
};

function basicHeader(user: string, password: string) {
  return `Basic ${btoa(`${user}:${password}`)}`;
}

test("respondents reach the survey without manager credentials", () => {
  for (const pathname of [
    "/answer/SHALOM-ABC123",
    "/api/survey/SHALOM-ABC123",
    "/api/survey/SHALOM-ABC123/submit",
  ]) {
    assert.strictEqual(
      decideBasicAuth(
        { pathname, method: "POST", authorization: null },
        CONFIGURED,
      ),
      "allow",
    );
  }
});

test("the AI service reaches MCP and the callback without a browser session", () => {
  assert.strictEqual(
    decideBasicAuth(
      { pathname: "/api/mcp", method: "POST", authorization: null },
      CONFIGURED,
    ),
    "allow",
  );

  assert.strictEqual(
    decideBasicAuth(
      {
        pathname: "/api/rounds/round-1/ai-insights",
        method: "POST",
        authorization: null,
      },
      CONFIGURED,
    ),
    "allow",
  );
});

test("reading AI insights stays behind the gate", () => {
  assert.strictEqual(
    decideBasicAuth(
      {
        pathname: "/api/rounds/round-1/ai-insights",
        method: "GET",
        authorization: null,
      },
      CONFIGURED,
    ),
    "challenge",
  );
});

test("a deployment without credentials fails closed", () => {
  assert.strictEqual(
    decideBasicAuth(
      { pathname: "/setup", method: "GET", authorization: null },
      { NODE_ENV: "production", VERCEL_ENV: "production" },
    ),
    "unconfigured",
  );
});

test("local development stays open without credentials", () => {
  assert.strictEqual(
    decideBasicAuth(
      { pathname: "/setup", method: "GET", authorization: null },
      { NODE_ENV: "development" },
    ),
    "allow",
  );
});

test("manager surfaces challenge anonymous and wrong credentials", () => {
  const cases = [
    null,
    "Bearer correct-horse",
    "Basic",
    "Basic !!!not-base64!!!",
    basicHeader("manager", "wrong"),
    basicHeader("intruder", "correct-horse"),
  ];

  for (const authorization of cases) {
    assert.strictEqual(
      decideBasicAuth(
        { pathname: "/api/manager/setup", method: "PUT", authorization },
        CONFIGURED,
      ),
      "challenge",
      `expected a challenge for ${String(authorization)}`,
    );
  }
});

test("correct credentials pass the gate", () => {
  assert.strictEqual(
    decideBasicAuth(
      {
        pathname: "/api/manager/setup",
        method: "PUT",
        authorization: basicHeader("manager", "correct-horse"),
      },
      CONFIGURED,
    ),
    "allow",
  );
});
