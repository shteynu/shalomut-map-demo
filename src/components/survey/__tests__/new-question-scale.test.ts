import assert from "node:assert";
import test from "node:test";
import { scaleForNewQuestion } from "../survey-builder/new-question-scale";
import type {
  BuilderAnalyticQuestion,
  BuilderBackgroundQuestion,
} from "../survey-builder/types";
import type { AnswerScaleId } from "@/lib/survey/answer-scales";

/**
 * The scale a new question opens on.
 *
 * The builder wrote `wellbeing-colour` into the literal at every place a
 * question is born, which was the only scale there was until the research
 * instrument. Under a questionnaire of 1–5 and 1–7 blocks that hands the
 * manager a colour question to put inside a Likert block.
 */

let nextKey = 0;

function analytic(
  scaleId: AnswerScaleId,
  dimensionId = "certainty",
  enabled = true,
): BuilderAnalyticQuestion {
  nextKey += 1;
  return {
    id: `q-${nextKey}`,
    draftKey: `draft-${nextKey}`,
    text: `שאלה ${nextKey}`,
    kind: "analytic",
    dimensionId: dimensionId as BuilderAnalyticQuestion["dimensionId"],
    scaleId,
    polarity: "positive",
    required: true,
    enabled,
  };
}

function background(): BuilderBackgroundQuestion {
  nextKey += 1;
  return {
    id: `bg-${nextKey}`,
    draftKey: `draft-${nextKey}`,
    text: "כמה שנים את/ה מלמד/ת?",
    kind: "background",
    answerMode: "number",
    required: false,
    enabled: true,
  };
}

test("an empty questionnaire still answers on the colour scale", () => {
  // The canonical 24 are answered on it, and a manager starting from nothing is
  // most likely building that shape. Nothing about this change moves it.
  assert.strictEqual(scaleForNewQuestion([], "certainty"), "wellbeing-colour");
});

test("a questionnaire of background questions alone has no scale to read", () => {
  assert.strictEqual(
    scaleForNewQuestion([background(), background()], "certainty"),
    "wellbeing-colour",
  );
});

test("a Likert questionnaire gives its new question the Likert scale", () => {
  const draft = [
    analytic("likert-7-frequency"),
    analytic("likert-7-frequency"),
    background(),
  ];

  assert.strictEqual(
    scaleForNewQuestion(draft, "certainty"),
    "likert-7-frequency",
  );
});

test("the dimension in hand outranks the draft-wide majority", () => {
  // One dimension's items can sit in blocks of different lengths, so the
  // majority across the whole questionnaire is the weaker guess.
  const draft = [
    analytic("likert-5-extent", "balance"),
    analytic("likert-5-extent", "balance"),
    analytic("likert-5-extent", "balance"),
    analytic("likert-7-frequency", "certainty"),
  ];

  assert.strictEqual(
    scaleForNewQuestion(draft, "certainty"),
    "likert-7-frequency",
  );
});

test("a dimension the draft does not cover yet falls back to the questionnaire", () => {
  const draft = [
    analytic("likert-7-frequency", "balance"),
    analytic("likert-7-frequency", "balance"),
  ];

  assert.strictEqual(
    scaleForNewQuestion(draft, "meaning"),
    "likert-7-frequency",
  );
});

test("a disabled question is not what the questionnaire asks", () => {
  // A manager switching a colour set off and a Likert set on is mid-migration,
  // and the next question they write belongs to the set that will be asked.
  const draft = [
    analytic("wellbeing-colour", "certainty", false),
    analytic("wellbeing-colour", "certainty", false),
    analytic("likert-5-extent", "certainty", true),
  ];

  assert.strictEqual(scaleForNewQuestion(draft, "certainty"), "likert-5-extent");
});

test("a draft switched off whole still answers from what it holds", () => {
  const draft = [
    analytic("likert-7-frequency", "certainty", false),
    analytic("likert-7-frequency", "certainty", false),
  ];

  assert.strictEqual(
    scaleForNewQuestion(draft, "certainty"),
    "likert-7-frequency",
  );
});

test("a tie goes to whichever the manager sees first", () => {
  // Deterministic, and in the order on screen rather than in the order of a map.
  const draft = [analytic("likert-5-extent"), analytic("likert-7-frequency")];

  assert.strictEqual(scaleForNewQuestion(draft, "certainty"), "likert-5-extent");
  assert.strictEqual(
    scaleForNewQuestion([...draft].reverse(), "certainty"),
    "likert-7-frequency",
  );
});
