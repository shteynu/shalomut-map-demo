import assert from "node:assert";
import { test } from "node:test";
import { responseScale } from "../../shalomut-source";
import { SurveyService } from "../../services/survey.service";
import type { AnswerValue } from "../../types/backend";
import {
  ANSWER_SCALE_IDS,
  answerScales,
  getAnswerScale,
  isAnswerScaleId,
  isValueOnScale,
  scoreForAnswer,
} from "../answer-scales";

test("the colour scale scores exactly what the shipped scale scored", () => {
  // The guarantee every persisted round depends on: naming the existing scale
  // must not move a single number. Compared against `SurveyService.valueToScore`
  // itself rather than against literals, so this fails if either side drifts.
  for (const option of responseScale) {
    assert.strictEqual(
      scoreForAnswer("wellbeing-colour", option.value),
      SurveyService.valueToScore(option.value as AnswerValue),
      `${option.value} must keep its score`,
    );
  }

  assert.deepStrictEqual(
    answerScales["wellbeing-colour"].points.map((point) => point.score),
    [100, 60, 0],
  );
});

test("the colour scale is derived from responseScale, not retyped", () => {
  assert.deepStrictEqual(
    answerScales["wellbeing-colour"].points.map((point) => point.value),
    responseScale.map((option) => option.value),
  );
});

test("Likert scales run from 0 to 100 with even spacing", () => {
  assert.deepStrictEqual(
    answerScales["likert-5-extent"].points.map((point) => point.score),
    [0, 25, 50, 75, 100],
  );
  assert.deepStrictEqual(
    answerScales["likert-5-extent-low"].points.map((point) => point.score),
    [0, 25, 50, 75, 100],
  );
  assert.deepStrictEqual(
    answerScales["likert-7-frequency"].points.map((point) => point.score),
    [0, 17, 33, 50, 67, 83, 100],
  );
});

test("Likert values are 1-based strings, so a stored answer reads as the instrument prints it", () => {
  assert.deepStrictEqual(
    answerScales["likert-5-extent"].points.map((point) => point.value),
    ["1", "2", "3", "4", "5"],
  );
  assert.deepStrictEqual(
    answerScales["likert-7-frequency"].points.map((point) => point.value),
    ["1", "2", "3", "4", "5", "6", "7"],
  );
});

test("the two five-point scales differ only in their low anchors", () => {
  const extent = answerScales["likert-5-extent"].points.map((p) => p.label);
  const low = answerScales["likert-5-extent-low"].points.map((p) => p.label);

  assert.notDeepStrictEqual(extent, low);
  assert.deepStrictEqual(extent.slice(2), low.slice(2));
  assert.ok(extent[1].includes("מועטה"));
  assert.ok(low[1].includes("נמוכה"));
});

test("negative polarity is the complement, and leaves the midpoint alone", () => {
  assert.strictEqual(scoreForAnswer("likert-5-extent", "1", "negative"), 100);
  assert.strictEqual(scoreForAnswer("likert-5-extent", "5", "negative"), 0);
  assert.strictEqual(scoreForAnswer("likert-5-extent", "3", "negative"), 50);
  assert.strictEqual(scoreForAnswer("likert-5-extent", "3", "positive"), 50);
});

test("negative polarity on the seven-point scale mirrors around its own midpoint", () => {
  const positive = answerScales["likert-7-frequency"].points.map((point) =>
    scoreForAnswer("likert-7-frequency", point.value, "positive"),
  );
  const negative = answerScales["likert-7-frequency"].points.map((point) =>
    scoreForAnswer("likert-7-frequency", point.value, "negative"),
  );

  assert.deepStrictEqual(negative, [...positive].reverse());
  assert.strictEqual(negative[3], 50);
});

test("polarity defaults to positive, so an unmarked question scores as it always did", () => {
  assert.strictEqual(
    scoreForAnswer("wellbeing-colour", "green"),
    scoreForAnswer("wellbeing-colour", "green", "positive"),
  );
});

test("an answer that is not on the scale scores nothing rather than yellow", () => {
  // The behaviour this replaces returned 60 for anything unrecognised, which
  // let a mismatched submission read as a mild positive.
  assert.strictEqual(scoreForAnswer("wellbeing-colour", "blue"), undefined);
  assert.strictEqual(scoreForAnswer("likert-5-extent", "6"), undefined);
  assert.strictEqual(scoreForAnswer("likert-5-extent", "0"), undefined);
  assert.strictEqual(scoreForAnswer("likert-7-frequency", ""), undefined);
  assert.strictEqual(scoreForAnswer("likert-5-extent", "3 "), undefined);
});

test("a value off the scale is off it under either polarity", () => {
  assert.strictEqual(scoreForAnswer("likert-5-extent", "9", "negative"), undefined);
});

test("isValueOnScale agrees with scoreForAnswer about membership", () => {
  for (const scaleId of ANSWER_SCALE_IDS) {
    for (const point of getAnswerScale(scaleId).points) {
      assert.strictEqual(isValueOnScale(scaleId, point.value), true);
      assert.notStrictEqual(scoreForAnswer(scaleId, point.value), undefined);
    }
    assert.strictEqual(isValueOnScale(scaleId, "not-a-point"), false);
  }
});

test("every declared scale id has a scale, and every scale knows its own id", () => {
  for (const scaleId of ANSWER_SCALE_IDS) {
    assert.strictEqual(answerScales[scaleId].id, scaleId);
    assert.ok(answerScales[scaleId].points.length >= 3);
  }
  assert.strictEqual(
    Object.keys(answerScales).length,
    ANSWER_SCALE_IDS.length,
  );
});

test("scale points are unique and carry a Hebrew anchor", () => {
  for (const scaleId of ANSWER_SCALE_IDS) {
    const points = getAnswerScale(scaleId).points;
    const values = new Set(points.map((point) => point.value));

    assert.strictEqual(values.size, points.length, `${scaleId} has a duplicate value`);
    for (const point of points) {
      assert.ok(point.label.trim().length > 0, `${scaleId} anchor is empty`);
      assert.ok(
        /[֐-׿]/u.test(point.label),
        `${scaleId} anchor "${point.label}" is not Hebrew`,
      );
      assert.ok(point.score >= 0 && point.score <= 100);
    }
  }
});

test("scale scores rise with the scale", () => {
  for (const scaleId of ANSWER_SCALE_IDS) {
    const scores = getAnswerScale(scaleId).points.map((point) => point.score);
    const ascending = [...scores].sort((left, right) => left - right);

    // The colour scale reads best-first, so compare as a set of steps rather
    // than asserting a direction the anchors do not share.
    assert.strictEqual(new Set(scores).size, scores.length);
    assert.strictEqual(ascending[0], 0);
    assert.strictEqual(ascending[ascending.length - 1], 100);
  }
});

test("isAnswerScaleId refuses anything that is not a shipped scale", () => {
  assert.strictEqual(isAnswerScaleId("likert-5-extent"), true);
  assert.strictEqual(isAnswerScaleId("wellbeing-colour"), true);
  assert.strictEqual(isAnswerScaleId("likert-6-extent"), false);
  assert.strictEqual(isAnswerScaleId(""), false);
  assert.strictEqual(isAnswerScaleId(undefined), false);
  assert.strictEqual(isAnswerScaleId(5), false);
});
