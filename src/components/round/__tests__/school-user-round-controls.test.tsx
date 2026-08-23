import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurveyRound } from "@/lib/types/backend";
import { RoundControls } from "../round-controls";

/**
 * A school user reads the round and does not act on it (owner decision,
 * 2026-08-23). That is enforced at the routes, which answer 403; this is the
 * screen keeping the same promise, so nobody is handed a button whose only
 * outcome is a refusal.
 *
 * `mayAct` answers a different question from `readOnly`: `readOnly` is about
 * the round — archived, or already superseded — and `mayAct` is about who is
 * looking at it. Both are asserted here because a round in an ordinary state
 * is exactly where the two would be confused.
 */
function controls(status: SurveyRound["status"], mayAct: boolean) {
  return renderToStaticMarkup(
    <RoundControls
      roundId="round-school-user"
      shareCode="ROUND-SCHOOL"
      responseCount={12}
      expectedResponses={24}
      minimumResponses={10}
      status={status}
      isSuperseded={false}
      mayAct={mayAct}
    />,
  );
}

test("a school user is offered no action on a round that is collecting", () => {
  const html = controls("active", false);

  assert.doesNotMatch(html, /סגירת סבב אבחון ידנית/);
  assert.doesNotMatch(html, /איפוס נתונים/);
  assert.doesNotMatch(html, /רענון ניתוח/);
  assert.doesNotMatch(html, /העברה לארכיון/);
});

test("a school user is offered no action on a closed round either", () => {
  // Closed is the state where an administrator has the most to do — re-run,
  // reset, archive — so it is the state where a leftover button is likeliest.
  const html = controls("closed", false);

  assert.doesNotMatch(html, /סגירת סבב אבחון ידנית/);
  assert.doesNotMatch(html, /איפוס נתונים/);
  assert.doesNotMatch(html, /רענון ניתוח/);
  assert.doesNotMatch(html, /העברה לארכיון/);
});

test("what a school user does keep is the link, the count and the map", () => {
  // Handing out the anonymous link and watching the count come in is the
  // school's own work during collection, and neither writes to the round.
  // Reading the map is the reason the screen is open to them at all.
  const html = controls("active", false);

  assert.match(html, /לינק הפצה/);
  assert.match(html, /ROUND-SCHOOL/);
  assert.match(html, /href="\/dashboard\?round=round-school-user"/);
});

test("an administrator on the same round still gets every action", () => {
  // The negative control: if these disappeared for everyone, the assertions
  // above would pass while the product was broken.
  const collecting = controls("active", true);
  const closed = controls("closed", true);

  assert.match(collecting, /סגירת סבב אבחון ידנית/);
  assert.match(collecting, /איפוס נתונים/);
  assert.match(collecting, /רענון ניתוח/);
  assert.match(closed, /העברה לארכיון/);
});
