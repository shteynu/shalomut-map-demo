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

test("a round divided about everything counts the rest instead of listing it", () => {
  // The shape a test round with near-random answers actually produced: all
  // eight dimensions split. Naming eight is the wallpaper this notice exists
  // to avoid.
  const html = render([
    { dimensionId: "self-expression", greenPercent: 47, redPercent: 37 },
    { dimensionId: "professional-competence", greenPercent: 37, redPercent: 47 },
    { dimensionId: "social-resource", greenPercent: 43, redPercent: 40 },
    { dimensionId: "balance", greenPercent: 43, redPercent: 43 },
    { dimensionId: "management-support", greenPercent: 40, redPercent: 43 },
    { dimensionId: "certainty", greenPercent: 37, redPercent: 57 },
    { dimensionId: "organizational-climate", greenPercent: 47, redPercent: 40 },
    { dimensionId: "meaning", greenPercent: 47, redPercent: 47 },
  ]);

  assert.match(html, /ב־8 ממדים/u);
  assert.match(html, /ועוד 5 ממדים/u);
  // The three widest are the ones named: balance and meaning are even splits,
  // then social-resource at 40.
  assert.match(html, /איזון/u);
  assert.match(html, /משמעות/u);
  assert.doesNotMatch(html, /ודאות/u);
});

test("one unnamed dimension is counted in the singular", () => {
  const html = render([
    { dimensionId: "balance", greenPercent: 50, redPercent: 50 },
    { dimensionId: "meaning", greenPercent: 45, redPercent: 45 },
    { dimensionId: "certainty", greenPercent: 40, redPercent: 40 },
    { dimensionId: "self-expression", greenPercent: 25, redPercent: 25 },
  ]);

  assert.match(html, /ועוד ממד אחד/u);
});
