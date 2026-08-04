import assert from "node:assert";
import { test } from "node:test";
import {
  NUDGE_STEP,
  NUDGE_STEP_LARGE,
  isNudgeKey,
  nextNudgeOffset,
} from "@/lib/dashboard/map-nudge";

const openStage = { minX: -500, maxX: 500, minY: -500, maxY: 500 };
const origin = { x: 0, y: 0 };

test("an arrow moves the stone one step in that screen direction", () => {
  assert.deepStrictEqual(nextNudgeOffset("ArrowLeft", origin, openStage), {
    x: -NUDGE_STEP,
    y: 0,
  });
  assert.deepStrictEqual(nextNudgeOffset("ArrowRight", origin, openStage), {
    x: NUDGE_STEP,
    y: 0,
  });
  assert.deepStrictEqual(nextNudgeOffset("ArrowUp", origin, openStage), {
    x: 0,
    y: -NUDGE_STEP,
  });
  assert.deepStrictEqual(nextNudgeOffset("ArrowDown", origin, openStage), {
    x: 0,
    y: NUDGE_STEP,
  });
});

test("holding shift crosses the stage faster", () => {
  assert.deepStrictEqual(nextNudgeOffset("ArrowRight", origin, openStage, true), {
    x: NUDGE_STEP_LARGE,
    y: 0,
  });
});

test("a stone cannot be walked off the stage", () => {
  const atEdge = { minX: -8, maxX: 8, minY: -8, maxY: 8 };

  assert.deepStrictEqual(nextNudgeOffset("ArrowRight", origin, atEdge, true), {
    x: 8,
    y: 0,
  });
  assert.deepStrictEqual(nextNudgeOffset("ArrowUp", origin, atEdge), {
    x: 0,
    y: -8,
  });
});

test("any other key is left to the browser", () => {
  for (const key of ["Enter", " ", "Tab", "a", "Home"]) {
    assert.strictEqual(isNudgeKey(key), false);
    assert.strictEqual(nextNudgeOffset(key, origin, openStage), null);
  }

  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    assert.strictEqual(isNudgeKey(key), true);
  }
});
