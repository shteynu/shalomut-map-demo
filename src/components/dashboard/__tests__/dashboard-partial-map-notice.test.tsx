import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardInsightsDto } from "@/lib/dashboard/dashboard-insights";
import { DashboardPartialMapNotice } from "../dashboard-partial-map-notice";

/**
 * The notice exists because the dimension screen is the wrong place to learn
 * that a dimension is missing: a manager who trusts the map never opens it.
 */

function gaps(
  overrides: Partial<DashboardInsightsDto["gapsByReason"]> = {},
): DashboardInsightsDto["gapsByReason"] {
  return {
    provider_unavailable: [],
    validation_rejected: [],
    unstated: [],
    ...overrides,
  };
}

function render(overrides: Partial<DashboardInsightsDto["gapsByReason"]>) {
  return renderToStaticMarkup(
    <DashboardPartialMapNotice gaps={gaps(overrides)} />,
  );
}

test("a whole map renders no notice at all", () => {
  assert.strictEqual(
    renderToStaticMarkup(<DashboardPartialMapNotice gaps={gaps()} />),
    "",
  );
});

test("one gap is named, in the singular, with its map caption", () => {
  const html = render({ unstated: ["balance"] });

  // The caption the map itself puts on that stone, not the contract's id and
  // not one of the dimension's other Hebrew names.
  assert.match(html, /ממד איזון/u);
  assert.match(html, /של הממד הזה מלאים/u);
  assert.doesNotMatch(html, /ממדים/u);
  assert.doesNotMatch(html, /balance/u);
});

test("several gaps are counted and listed", () => {
  const html = render({
    unstated: ["balance", "certainty", "management-support"],
  });

  assert.match(html, /3 ממדים/u);
  assert.match(html, /איזון, ודאות, עורף מקצועי/u);
  assert.match(html, /של הממדים האלה מלאים/u);
});

test("a silent provider and refused copy are told apart", () => {
  const silent = render({ provider_unavailable: ["balance"] });
  const refused = render({ validation_rejected: ["balance"] });

  // Different causes, and — the reason the cause travels at all — different
  // next moves.
  assert.match(silent, /שירות הניתוח לא השיב/u);
  assert.match(silent, /בעוד מספר דקות/u);
  assert.doesNotMatch(silent, /בדיקות האיכות/u);

  assert.match(refused, /לא עמד בבדיקות האיכות/u);
  assert.match(refused, /ניסוח אחר/u);
  assert.doesNotMatch(refused, /שירות הניתוח לא השיב/u);
});

test("a round with both causes says both, each about its own dimensions", () => {
  const html = render({
    provider_unavailable: ["balance"],
    validation_rejected: ["certainty", "meaning"],
  });

  assert.match(html, /שירות הניתוח לא השיב עבור ממד איזון/u);
  assert.match(html, /הניתוח שנוצר עבור 2 ממדים — ודאות, משמעות/u);
  // Three dimensions in total, so the closing sentence is plural even though
  // one of the two groups is a single dimension.
  assert.match(html, /של הממדים האלה מלאים/u);
});

test("a round from before the reason existed claims no cause", () => {
  const html = render({ unstated: ["balance"] });

  assert.match(html, /לא נוצר ניתוח מילולי/u);
  assert.doesNotMatch(html, /שירות הניתוח לא השיב/u);
  assert.doesNotMatch(html, /בדיקות האיכות/u);
});
