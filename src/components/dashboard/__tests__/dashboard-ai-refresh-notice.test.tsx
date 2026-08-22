/**
 * What the manager is told about a map that is being replaced.
 *
 * The map now survives a re-analysis, which is the fix; the note is what keeps
 * that from being a silent screen. Without it a manager who pressed "rewrite
 * this dimension" would see the same map, no spinner and no message, and would
 * have no way to tell whether anything had happened — or, after a failed
 * re-run, that the map in front of them is the previous one.
 */
import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardAiRefreshNotice } from "../dashboard-ai-insights-state";

test("a map nothing is replacing carries no note", () => {
  assert.strictEqual(
    renderToStaticMarkup(<DashboardAiRefreshNotice refresh={undefined} />),
    "",
  );
});

test("a re-analysis in flight says the map is the previous one", () => {
  const html = renderToStaticMarkup(
    <DashboardAiRefreshNotice refresh={{ state: "running" }} />,
  );

  assert.match(html, /הניתוח האחרון שהושלם/);
  assert.match(html, /ניתוח מחדש פועל כעת/);
  // Not an alert: the map is readable and its numbers are real.
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /role="alert"/);
});

test("a re-analysis that failed says the map did not change", () => {
  const html = renderToStaticMarkup(
    <DashboardAiRefreshNotice
      refresh={{ state: "failed", failureCode: "provider_unavailable" }}
    />,
  );

  assert.match(html, /הניתוח האחרון שהושלם/);
  assert.match(html, /נכשל/);
  // The failure code belongs in a log. It names our internals, and it would be
  // the only English on a Hebrew screen.
  assert.doesNotMatch(html, /provider_unavailable/);
});
