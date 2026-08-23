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

test("an uptime monitor reaches the health endpoints, and only by reading", () => {
  // All three verdicts a free monitor watches. The queue's and the counters'
  // are the ones that matter here: a detector nobody can reach is the failure
  // each of them was built to end, and the manager gate is what would make it
  // unreachable. Route tests call the handler directly and would pass on a
  // route the middleware answers with 401.
  for (const pathname of [
    "/api/health",
    "/api/health/",
    "/api/health/ai-queue",
    "/api/health/ai-queue/",
    "/api/health/observability",
    "/api/health/observability/",
  ]) {
    for (const method of ["GET", "HEAD"]) {
      assert.strictEqual(
        isPublicOperationalRoute(pathname, method),
        true,
        `expected ${method} ${pathname} to be reachable by a monitor`,
      );
    }
  }

  // A monitor never writes, and these endpoints have no other method today. The
  // day one is added it must be decided on, not inherited.
  assert.strictEqual(isPublicOperationalRoute("/api/health", "POST"), false);
  assert.strictEqual(isPublicOperationalRoute("/api/health", "DELETE"), false);
  assert.strictEqual(
    isPublicOperationalRoute("/api/health/observability", "POST"),
    false,
  );
});

test("the counters' numbers are machine-authenticated, and read-only", () => {
  // The public sibling publishes a word and a list of ids; the counts sit here,
  // behind the same shared secret the queue's depth does.
  for (const pathname of ["/api/observability", "/api/observability/"]) {
    assert.strictEqual(isMachineAuthenticatedRoute(pathname, "GET"), true);
    assert.strictEqual(isMachineAuthenticatedRoute(pathname, "HEAD"), true);
    assert.strictEqual(isMachineAuthenticatedRoute(pathname, "POST"), false);
    // And it is not anonymous, which is the whole of the split.
    assert.strictEqual(isPublicOperationalRoute(pathname, "GET"), false);
  }
});

test("nothing else is opened by the operational bypass", () => {
  for (const pathname of [
    "/api/healthz",
    "/api/health/detail",
    "/api/observability",
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
