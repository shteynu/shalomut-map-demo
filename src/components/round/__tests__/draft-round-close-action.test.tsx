import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { isRoundTransitionAllowed } from "@/lib/rounds/round-status";
import type { SurveyRound } from "@/lib/types/backend";
import { RoundControls, closeFailureMessage } from "../round-controls";

/**
 * A draft round used to offer `סגירת סבב אבחון ידנית` as a live button. Pressing
 * it reached a route that refuses `draft → closed`, and the refusal — written in
 * English for the log — was printed into the Hebrew screen as
 * `Transition from 'draft' to 'closed' is not allowed.`
 *
 * Found on the deployed endpoint on 2026-08-09. Two defects in one press: a
 * control that could not work, and an internal string as the explanation.
 */

const closeButton =
  /<button[^>]*\bdisabled\b[^>]*>(?:(?!<\/button>)[\s\S])*?סגירת סבב אבחון ידנית/;

function controls(status: SurveyRound["status"]) {
  return renderToStaticMarkup(
    <RoundControls
      roundId="round-draft"
      shareCode="ROUND-DRAFT"
      responseCount={0}
      expectedResponses={24}
      minimumResponses={10}
      status={status}
    />,
  );
}

test("a draft round cannot be closed, so its close button cannot be pressed", () => {
  // A draft has collected nothing yet: it opens, or it is filed away.
  assert.match(controls("draft"), closeButton);
});

test("a round that is collecting answers still closes", () => {
  assert.doesNotMatch(controls("active"), closeButton);
});

test("the close button says why it is unavailable", () => {
  assert.match(controls("draft"), /סגירה ידנית אפשרית רק לסבב שאוסף תשובות/);
  assert.match(controls("active"), /סימון הסבב כסגור/);
});

test("the screen decides by the same rule the route refuses by", () => {
  // The bug was two lists of statuses that disagreed. There is one now, and
  // this is the pairing that used to be missing from the screen's copy of it.
  assert.strictEqual(isRoundTransitionAllowed("draft", "closed"), false);
  assert.strictEqual(isRoundTransitionAllowed("archived", "closed"), false);
  assert.strictEqual(isRoundTransitionAllowed("closed", "closed"), false);
  assert.strictEqual(isRoundTransitionAllowed("active", "closed"), true);
});

test("a failed close is explained in the language the screen is written in", () => {
  for (const status of [409, 503, 500, 403, undefined]) {
    const message = closeFailureMessage(status);

    assert.doesNotMatch(
      message,
      /[A-Za-z]/u,
      `a ${status} answer put Latin script on a Hebrew screen: ${message}`,
    );
  }
});

test("a refused close tells the manager the round moved on without them", () => {
  // With the button gated on the round's status, a 409 is no longer a dead
  // press — it means the round changed since the page was rendered.
  assert.match(closeFailureMessage(409), /רעננו את הדף/);
  assert.match(closeFailureMessage(503), /נסו שוב מאוחר יותר/);
  assert.match(closeFailureMessage(500), /לא ניתן היה לסגור את הסבב/);
});
