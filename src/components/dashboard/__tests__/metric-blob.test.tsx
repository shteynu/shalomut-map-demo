import assert from "node:assert";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricBlob } from "../metric-blob";

const LATIN = /[A-Za-z]/u;

const METRIC = {
  label: "עומס משימות",
  value: "60 מתוך 100",
  helper: "20 משיבים · 12 באמצע · 4 גבוה · 4 נמוך",
  distribution: { green: 4, yellow: 12, red: 4 },
};

test("the split is drawn to scale and hidden from assistive technology", () => {
  const html = renderToStaticMarkup(<MetricBlob metric={METRIC} />);

  // The bar repeats the sentence above it, so a screen reader that read both
  // would say every number twice.
  assert.match(html, /aria-hidden="true"/u);
  assert.match(html, /flex-grow:12/u);
  assert.match(html, /flex-grow:4/u);
});

test("the numbers survive without the bar and without colour", () => {
  const html = renderToStaticMarkup(<MetricBlob metric={METRIC} />);
  const text = html.replace(/<[^>]*>/gu, "");

  assert.match(text, /20 משיבים/u);
  assert.match(text, /12 באמצע/u);
  assert.doesNotMatch(text, LATIN);
});

test("a metric without a split draws no bar", () => {
  const html = renderToStaticMarkup(
    <MetricBlob metric={{ label: "עומס משימות", value: "60 מתוך 100", helper: "3 משיבים" }} />,
  );

  assert.doesNotMatch(html, /dashboard-metric-distribution/u);
});

test("an AI highlight replaces the helper line, so its bar goes with it", () => {
  const html = renderToStaticMarkup(
    <MetricBlob metric={{ ...METRIC, highlightText: "הציון בשאלה זו נמוך מהשאר." }} />,
  );

  assert.match(html, /הציון בשאלה זו נמוך מהשאר/u);
  assert.doesNotMatch(html, /dashboard-metric-distribution/u);
});

test("a Contract V6 narrative metric renders no numeric value or distribution", () => {
  const html = renderToStaticMarkup(
    <MetricBlob
      metric={{
        ...METRIC,
        value: "",
        helper: "",
        highlightText: "התשובות מצביעות על צורך בחיזוק שגרה משותפת.",
        narrativeOnly: true,
      }}
    />,
  );
  const text = html.replace(/<[^>]*>/gu, "");

  assert.match(text, /התשובות מצביעות/u);
  assert.doesNotMatch(text, /\d/u);
  assert.doesNotMatch(html, /<strong>/u);
  assert.doesNotMatch(html, /dashboard-metric-distribution/u);
});
