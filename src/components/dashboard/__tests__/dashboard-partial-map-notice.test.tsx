import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardPartialMapNotice } from "../dashboard-partial-map-notice";

/**
 * The notice exists because the dimension screen is the wrong place to learn
 * that a dimension is missing: a manager who trusts the map never opens it.
 */

test("a whole map renders no notice at all", () => {
  assert.strictEqual(
    renderToStaticMarkup(<DashboardPartialMapNotice dimensionIds={[]} />),
    "",
  );
});

test("one gap is named, in the singular, with its screen label", () => {
  const html = renderToStaticMarkup(
    <DashboardPartialMapNotice dimensionIds={["balance"]} />,
  );

  // The caption the map itself puts on that stone, not the contract's id and
  // not one of the dimension's other Hebrew names.
  assert.match(html, /לממד איזון/u);
  assert.match(html, /בלעדיו/u);
  assert.doesNotMatch(html, /ממדים/u);
  assert.doesNotMatch(html, /balance/u);
});

test("several gaps are counted and listed", () => {
  const html = renderToStaticMarkup(
    <DashboardPartialMapNotice
      dimensionIds={["balance", "certainty", "management-support"]}
    />,
  );

  assert.match(html, /ל־3 ממדים/u);
  assert.match(html, /איזון, ודאות, עורף מקצועי/u);
  assert.match(html, /בלעדיהם/u);
});

test("the notice says the rest of the dimension is intact", () => {
  const html = renderToStaticMarkup(
    <DashboardPartialMapNotice dimensionIds={["balance"]} />,
  );

  // Without this the notice reads as "the analysis is broken", which is a
  // different and untrue thing: the score, the questions and the
  // recommendations of that dimension are all real.
  assert.match(html, /ההמלצות של הממד הזה מלאים/u);
  assert.match(html, /ניתוח מחדש/u);
});
