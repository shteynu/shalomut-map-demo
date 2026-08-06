import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurveyRound } from "@/lib/types/backend";
import { RoundControls } from "../round-controls";

/**
 * A superseded round is one the school has moved past: opening a new round
 * closes the previous one, and the previous one is then read rather than
 * worked on. It is a different state from `archived`, which is a round the
 * manager deliberately filed away.
 */
function controls(status: SurveyRound["status"], isSuperseded: boolean) {
  return renderToStaticMarkup(
    <RoundControls
      roundId="round-previous"
      shareCode="ROUND-PREVIOUS"
      responseCount={12}
      expectedResponses={24}
      minimumResponses={10}
      status={status}
      isSuperseded={isSuperseded}
    />,
  );
}

test("a superseded round offers nothing that would rewrite what it measured", () => {
  const html = controls("closed", true);

  assert.doesNotMatch(html, /איפוס נתונים/);
  assert.doesNotMatch(html, /רענון ניתוח/);
});

test("a closed round that is still the newest one keeps both", () => {
  const html = controls("closed", false);

  // Closing a round and then refreshing its analysis is how a round ends.
  assert.match(html, /איפוס נתונים/);
  assert.match(html, /רענון ניתוח/);
});

test("a superseded round can still be filed away", () => {
  // Archiving does not rewrite what the round measured, and a superseded round
  // is exactly the one a manager wants out of the everyday list.
  assert.match(controls("closed", true), /העברה לארכיון/);
});

test("the note says why the round is read-only and that goals are not", () => {
  const html = controls("closed", true);

  assert.match(html, /זהו סבב קודם/);
  assert.match(html, /לקריאה\s*בלבד/);
  assert.match(html, /היעדים שנבחרו בו ממשיכים להתעדכן/);
});

test("a superseded round is not also announced as merely closed", () => {
  assert.doesNotMatch(controls("closed", true), /מסומן כסגור/);
  assert.match(controls("closed", false), /מסומן כסגור/);
});

test("an archived round says it was archived rather than merely superseded", () => {
  const html = controls("archived", true);

  assert.match(html, /הסבב הועבר לארכיון/);
  assert.doesNotMatch(html, /זהו סבב קודם/);
});

test("the map link carries the round, so it opens this one and not the newest", () => {
  assert.match(controls("closed", true), /href="\/dashboard\?round=round-previous"/);
});
