import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DimensionDivision } from "@/lib/dashboard/dimension-division";
import { DashboardDividedDimensionsNotice } from "../dashboard-divided-dimensions-notice";

function render(divisions: DimensionDivision[]) {
  return renderToStaticMarkup(
    <DashboardDividedDimensionsNotice divisions={divisions} />,
  );
}

test("a staff room that agrees with itself gets no notice at all", () => {
  assert.strictEqual(render([]), "");
});

test("one divided dimension is named by its caption on the map", () => {
  const html = render([
    { dimensionId: "balance", greenPercent: 60, redPercent: 40 },
  ]);

  // The stone's caption, not the contract's id: any other Hebrew name would
  // send a manager looking for a stone that is not on the map.
  assert.match(html, /ממד אחד/u);
  assert.match(html, /איזון/u);
  assert.doesNotMatch(html, /balance/u);
});

test("both ends are given, because the split is the content", () => {
  const html = render([
    { dimensionId: "balance", greenPercent: 60, redPercent: 40 },
  ]);

  assert.match(html, /40% אדום מול 60% ירוק/u);
  // And the reason it is worth saying: the score cannot carry it.
  assert.match(html, /הציון הממוצע לא מראה/u);
});

test("several divided dimensions are counted and each one detailed", () => {
  const html = render([
    { dimensionId: "balance", greenPercent: 50, redPercent: 30 },
    { dimensionId: "meaning", greenPercent: 40, redPercent: 35 },
  ]);

  assert.match(html, /ב־2 ממדים/u);
  assert.match(html, /30% אדום מול 50% ירוק/u);
  assert.match(html, /35% אדום מול 40% ירוק/u);
});
