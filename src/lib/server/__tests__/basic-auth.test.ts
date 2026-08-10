import assert from "node:assert/strict";
import test from "node:test";
import {
  isMachineAuthenticatedRoute,
  isPublicOperationalRoute,
  isRespondentRoute,
} from "../basic-auth";

test("respondents reach the survey without a manager session", () => {
  for (const pathname of [
    "/answer",
    "/answer/",
    "/answer/SHALOM-ABC123",
    "/answer/SHALOM-ABC123/",
    "/api/survey/SHALOM-ABC123",
    "/api/survey/SHALOM-ABC123/submit",
    "/api/survey/SHALOM-ABC123/submit/",
  ]) {
    assert.strictEqual(
      isRespondentRoute(pathname),
      true,
      `expected ${pathname} to be a respondent route`,
    );
  }
});

test("manager surfaces are not respondent routes", () => {
  for (const pathname of [
    "/",
    "/setup",
    "/dashboard",
    "/api/manager/setup",
    "/api/rounds",
    "/answering",
  ]) {
    assert.strictEqual(
      isRespondentRoute(pathname),
      false,
      `expected ${pathname} to stay behind the manager gate`,
    );
  }
});

test("the AI service reaches MCP, durable jobs, and the callback without a browser session", () => {
  assert.strictEqual(isMachineAuthenticatedRoute("/api/mcp", "POST"), true);
  assert.strictEqual(isMachineAuthenticatedRoute("/api/mcp/", "POST"), true);
  assert.strictEqual(
    isMachineAuthenticatedRoute("/api/rounds/round-1/ai-insights", "POST"),
    true,
  );
  assert.strictEqual(
    isMachineAuthenticatedRoute("/api/rounds/round-1/ai-insights/", "POST"),
    true,
  );
  for (const pathname of [
    "/api/ai-analysis-runs/claim",
    "/api/ai-analysis-runs/run-1/heartbeat/",
    "/api/ai-analysis-runs/run-1/fail",
  ]) {
    assert.strictEqual(isMachineAuthenticatedRoute(pathname, "POST"), true);
  }
});

test("reading AI insights stays behind the manager gate", () => {
  assert.strictEqual(
    isMachineAuthenticatedRoute("/api/rounds/round-1/ai-insights", "GET"),
    false,
  );
  assert.strictEqual(
    isMachineAuthenticatedRoute("/api/rounds/round-1/trigger-ai", "POST"),
    false,
  );
});

test("an uptime monitor reaches the health endpoint, and only by reading", () => {
  assert.strictEqual(isPublicOperationalRoute("/api/health", "GET"), true);
  assert.strictEqual(isPublicOperationalRoute("/api/health/", "GET"), true);
  assert.strictEqual(isPublicOperationalRoute("/api/health", "HEAD"), true);

  // A monitor never writes, and the endpoint has no other method today. The
  // day one is added it must be decided on, not inherited.
  assert.strictEqual(isPublicOperationalRoute("/api/health", "POST"), false);
  assert.strictEqual(isPublicOperationalRoute("/api/health", "DELETE"), false);
});

test("nothing else is opened by the operational bypass", () => {
  for (const pathname of [
    "/api/healthz",
    "/api/health/detail",
    "/api/rounds",
    "/api/mcp",
    "/",
  ]) {
    assert.strictEqual(
      isPublicOperationalRoute(pathname, "GET"),
      false,
      `expected ${pathname} to stay behind the manager gate`,
    );
  }
});
