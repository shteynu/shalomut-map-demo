import assert from "node:assert";
import { test } from "node:test";
import {
  matchesSearch,
  moveQuestionWithinView,
  setEnabledForKeys,
  visibleQuestionsFor,
} from "../survey-builder/question-list-operations";
import type { BuilderQuestion } from "../survey-builder/types";

function question(
  draftKey: string,
  dimensionId: BuilderQuestion["dimensionId"],
  text: string,
  enabled = true,
): BuilderQuestion {
  return {
    draftKey,
    id: draftKey,
    dimensionId,
    text,
    required: true,
    enabled,
    answerMode: "סקאלת צבעים",
  };
}

const questions = [
  question("q1", "balance", "אני מצליח לשמור על גבולות בין עבודה לבית"),
  question("q2", "meaning", "העבודה שלי משמעותית עבורי"),
  question("q3", "balance", "יש לי זמן להתאוששות במהלך השבוע", false),
];

const keys = (list: BuilderQuestion[]) => list.map((entry) => entry.draftKey);

test("search reads the question text", () => {
  assert.strictEqual(matchesSearch(questions[0], "גבולות"), true);
  assert.strictEqual(matchesSearch(questions[0], "משמעותית"), false);
});

test("search reads the dimension label too", () => {
  const balanceLabel = visibleQuestionsFor(questions, "all", "איזון");

  assert.deepStrictEqual(keys(balanceLabel), ["q1", "q3"]);
});

test("an empty search leaves the list alone", () => {
  assert.deepStrictEqual(keys(visibleQuestionsFor(questions, "all", "   ")), [
    "q1",
    "q2",
    "q3",
  ]);
});

test("the dimension tab and the search both narrow the list", () => {
  assert.deepStrictEqual(
    keys(visibleQuestionsFor(questions, "balance", "התאוששות")),
    ["q3"],
  );
  assert.deepStrictEqual(
    keys(visibleQuestionsFor(questions, "meaning", "התאוששות")),
    [],
  );
});

test("a bulk change touches only what is on screen", () => {
  const updated = setEnabledForKeys(questions, ["q1", "q3"], false);

  assert.deepStrictEqual(
    updated.map((entry) => entry.enabled),
    [false, true, false],
  );
});

test("moving up swaps with the question above it in the view", () => {
  const moved = moveQuestionWithinView(
    questions,
    ["q1", "q2", "q3"],
    "q2",
    -1,
  );

  assert.deepStrictEqual(keys(moved), ["q2", "q1", "q3"]);
});

test("a filtered view moves past what the filter hides", () => {
  // Only the two balance questions are on screen, so moving q3 up puts it where
  // q1 was — q2 keeps its own place in the full list.
  const moved = moveQuestionWithinView(questions, ["q1", "q3"], "q3", -1);

  assert.deepStrictEqual(keys(moved), ["q3", "q2", "q1"]);
});

test("the ends of the view do not move", () => {
  assert.deepStrictEqual(
    keys(moveQuestionWithinView(questions, ["q1", "q2", "q3"], "q1", -1)),
    ["q1", "q2", "q3"],
  );
  assert.deepStrictEqual(
    keys(moveQuestionWithinView(questions, ["q1", "q2", "q3"], "q3", 1)),
    ["q1", "q2", "q3"],
  );
});
