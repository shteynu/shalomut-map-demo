import assert from "node:assert";
import { test } from "node:test";
import { formatRatio, formatScorePercent } from "../format";
import { calculatePercentage, clamp } from "../math";

test("clamp restricts values to min and max boundaries", () => {
  assert.strictEqual(clamp(5, 0, 10), 5);
  assert.strictEqual(clamp(-5, 0, 10), 0);
  assert.strictEqual(clamp(15, 0, 10), 10);
  assert.strictEqual(clamp(0, 0, 100), 0);
  assert.strictEqual(clamp(100, 0, 100), 100);
});

test("calculatePercentage handles normal values and zero total edge cases", () => {
  assert.strictEqual(calculatePercentage(15, 20), 75);
  assert.strictEqual(calculatePercentage(1, 3), 33);
  assert.strictEqual(calculatePercentage(0, 50), 0);
  assert.strictEqual(calculatePercentage(50, 0), 0);
  assert.strictEqual(calculatePercentage(10, -5), 0);
});

test("formatScorePercent formats scores correctly", () => {
  assert.strictEqual(formatScorePercent(85), "85%");
  assert.strictEqual(formatScorePercent(74.6), "75%");
  assert.strictEqual(formatScorePercent(0), "0%");
});

test("formatRatio formats ratio strings correctly", () => {
  assert.strictEqual(formatRatio(15, 20), "15/20");
  assert.strictEqual(formatRatio(0, 10), "0/10");
});
