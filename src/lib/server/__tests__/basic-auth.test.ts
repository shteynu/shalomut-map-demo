import assert from "node:assert/strict";
import test from "node:test";
import {
  isMachineAuthenticatedRoute,
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

test("the AI service reaches MCP and the callback without a browser session", () => {
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
