import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SurveyRound } from "@/lib/types/backend";
import { RoundControls } from "../round-controls";

function controls(status: SurveyRound["status"]) {
  return renderToStaticMarkup(
    <RoundControls
      roundId="round-archive"
      shareCode="ROUND-ARCHIVE"
      responseCount={12}
      expectedResponses={24}
      minimumResponses={10}
      status={status}
    />,
  );
}

test("a running round cannot be filed away before it is closed", () => {
  assert.doesNotMatch(controls("active"), /העברה לארכיון/);
});

test("a closed round can be filed away", () => {
  assert.match(controls("closed"), /העברה לארכיון/);
});

test("an archived round offers no second archiving and says where it went", () => {
  const html = controls("archived");

  assert.doesNotMatch(html, /העברה לארכיון/);
  assert.match(html, /הסבב הועבר לארכיון/);
  assert.match(html, /נשאר זמין דרך הארכיון/);
});

test("an archived round is not also announced as merely closed", () => {
  assert.doesNotMatch(controls("archived"), /מסומן כסגור/);
});

const closeButton = /<button[^>]*\bdisabled\b[^>]*>(?:(?!<\/button>)[\s\S])*?סגירת סבב אבחון ידנית/;

test("closing is not offered on an archived round, which has no way out", () => {
  assert.match(controls("archived"), closeButton);
  assert.doesNotMatch(controls("active"), closeButton);
});

test("an archived round offers nothing that would rewrite what it measured", () => {
  const html = controls("archived");

  // Both routes answer 409 now, so a button here would only fail. Reset is the
  // one that mattered most: it used to write `draft` and take the round back
  // out of the archive.
  assert.doesNotMatch(html, /איפוס נתונים/);
  assert.doesNotMatch(html, /רענון ניתוח/);
  assert.match(controls("closed"), /איפוס נתונים/);
  assert.match(controls("closed"), /רענון ניתוח/);
});

test("the archive note says it is read-only and that goals are not", () => {
  const html = controls("archived");

  assert.match(html, /לקריאה בלבד/);
  assert.match(html, /היעדים שנבחרו בו ממשיכים להתעדכן/);
});
