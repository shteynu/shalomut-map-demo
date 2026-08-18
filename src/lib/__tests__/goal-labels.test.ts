import assert from "node:assert";
import { test } from "node:test";
import {
  goalActionLabels,
  goalGroupLabels,
  goalStatusLabels,
} from "../goals/labels";
import { ROUND_GOAL_STATUSES } from "../types/round-goal";

/**
 * These labels are shared because two screens render them and nothing puts the
 * two on one page, so a disagreement between them would be invisible until a
 * manager met both. What is worth testing is therefore coverage and distinctness
 * rather than the wording itself.
 */

test("every goal status has a label, and no two share one", () => {
  for (const status of ROUND_GOAL_STATUSES) {
    const label = goalStatusLabels[status];
    assert.ok(
      typeof label === "string" && label.trim().length > 0,
      `status ${status} has no label, so its button would render empty`,
    );
  }

  const labels = ROUND_GOAL_STATUSES.map((status) => goalStatusLabels[status]);
  assert.strictEqual(
    new Set(labels).size,
    labels.length,
    "two statuses sharing a label make the control unreadable",
  );

  // A status added to the union without a label here is the failure this
  // guards: the type would allow it and the screens would render nothing.
  assert.strictEqual(
    Object.keys(goalStatusLabels).length,
    ROUND_GOAL_STATUSES.length,
  );
});

test("the open group is not the in-progress status wearing another name", () => {
  // The group holds `selected` as well as `in_progress`, so if the two ever
  // read identically a manager would see a goal labelled with its group and
  // reasonably conclude the screen had lost its state.
  assert.notStrictEqual(goalGroupLabels.open, goalStatusLabels.in_progress);
  assert.notStrictEqual(goalGroupLabels.done, goalStatusLabels.done);
});

test("the remove action is labelled, since the guide quotes it", () => {
  assert.ok(goalActionLabels.remove.trim().length > 0);
});
