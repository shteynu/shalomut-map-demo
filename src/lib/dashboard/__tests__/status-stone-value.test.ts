import assert from "node:assert";
import test from "node:test";
import {
  STATUS_STONE_UNAVAILABLE,
  describeStatusStone,
} from "../status-stone-value";

test("a locked round shows no number and says when it will", () => {
  const stone = describeStatusStone(null, 10, "אבנים הדורשות התייחסות במפה", "below-threshold");

  assert.strictEqual(stone.value, STATUS_STONE_UNAVAILABLE);
  assert.strictEqual(stone.helper, "ייפתח לאחר 10 תשובות");
  assert.match(stone.screenReaderValue ?? "", /אין נתון/);
});

test("the locked helper follows the round's own threshold", () => {
  assert.strictEqual(describeStatusStone(null, 20, "x", "below-threshold").helper, "ייפתח לאחר 20 תשובות");
});

test("a round still collecting is not promised to open at a number of answers", () => {
  // It opens when it closes, however many answers are in (ADR-030). A stone
  // saying "after 10 answers" beside a round holding seventeen is a promise
  // the manager watches stay false, which is the whole subject of this file.
  const stone = describeStatusStone(null, 10, "x", "still-collecting");

  assert.strictEqual(stone.value, STATUS_STONE_UNAVAILABLE);
  assert.strictEqual(stone.helper, "ייפתח בסגירת הסבב");
});

test("an open round shows its count and its own helper", () => {
  const stone = describeStatusStone(3, 10, "אבנים הדורשות התייחסות במפה", null);

  assert.strictEqual(stone.value, "3");
  assert.strictEqual(stone.helper, "אבנים הדורשות התייחסות במפה");
  assert.strictEqual(stone.screenReaderValue, undefined);
});

test("a real zero on an open round is still zero", () => {
  // The distinction the whole change is about: an open round that genuinely
  // found no red dimension says so, and only the locked one withholds.
  const stone = describeStatusStone(0, 10, "אבנים הדורשות התייחסות במפה", null);

  assert.strictEqual(stone.value, "0");
  assert.notStrictEqual(stone.value, STATUS_STONE_UNAVAILABLE);
  assert.strictEqual(stone.screenReaderValue, undefined);
});
