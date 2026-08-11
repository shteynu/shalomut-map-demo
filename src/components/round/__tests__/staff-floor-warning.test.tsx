import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";
import { StaffFloorWarning } from "../staff-floor-warning";

function render(totalStaffCount: number, privacyThreshold = MINIMUM_PRIVACY_THRESHOLD) {
  return renderToStaticMarkup(
    <StaffFloorWarning
      id="staff-floor"
      totalStaffCount={totalStaffCount}
      privacyThreshold={privacyThreshold}
    />,
  );
}

test("a staff smaller than the threshold names both numbers", () => {
  const html = render(8);

  assert.match(html, /8 אנשי צוות/);
  assert.match(html, new RegExp(`של ${MINIMUM_PRIVACY_THRESHOLD} משיבים`));
  assert.match(html, /לא ייפתחו לעולם/);
  assert.match(html, /id="staff-floor"/);
});

test("a staff that can reach the threshold says nothing", () => {
  assert.strictEqual(render(MINIMUM_PRIVACY_THRESHOLD), "");
  assert.strictEqual(render(40), "");
});

test("a raised threshold moves the warning with it", () => {
  assert.match(render(14, 20), /של 20 משיבים/);
  assert.strictEqual(render(20, 20), "");
});

test("an unfilled field is not a disagreement between two numbers", () => {
  // The empty input arrives as `Number("")`, which is 0, and `Number("x")` as
  // NaN. Neither is a staff room the manager described, and `required` owns
  // the empty case.
  assert.strictEqual(render(0), "");
  assert.strictEqual(render(Number.NaN), "");
});
