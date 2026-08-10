import assert from "node:assert/strict";
import test from "node:test";
import { describeStaffFloorRefusal } from "../staff-floor";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";

test("a staff that cannot reach its own threshold cannot run a round", () => {
  const refusal = describeStaffFloorRefusal(8, MINIMUM_PRIVACY_THRESHOLD);

  assert.ok(refusal);
  // The manager has to be able to see which two numbers disagree, or the
  // refusal reads as the product being broken.
  assert.match(refusal.message, /8/u);
  assert.match(refusal.message, new RegExp(String(MINIMUM_PRIVACY_THRESHOLD), "u"));
});

test("a staff exactly the size of the threshold is allowed", () => {
  // Everyone answering is a hard round to run, but it is a round that can
  // finish. This function refuses the impossible, not the difficult.
  assert.strictEqual(describeStaffFloorRefusal(10, 10), null);
  assert.strictEqual(describeStaffFloorRefusal(40, 10), null);
});

test("a manager who raised the threshold raised the floor with it", () => {
  assert.strictEqual(describeStaffFloorRefusal(14, 20)?.privacyThreshold, 20);
  assert.strictEqual(describeStaffFloorRefusal(20, 20), null);
});
