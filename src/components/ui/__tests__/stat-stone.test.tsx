import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatStone } from "../stat-stone";

test("a plain stone reads its own value", () => {
  const html = renderToStaticMarkup(
    <StatStone value="3" label="מוקדי טיפול" helper="אבנים במפה" shape={3} tint="var(--pastel-pink)" />,
  );

  assert.match(html, /<strong>3<\/strong>/);
  assert.doesNotMatch(html, /visually-hidden/);
});

test("a stand-in value is hidden from the reader and replaced by words", () => {
  const html = renderToStaticMarkup(
    <StatStone
      value="—"
      screenReaderValue="עדיין אין נתון"
      label="מוקדי טיפול"
      helper="ייפתח לאחר 10 תשובות"
      shape={3}
      tint="var(--pastel-pink)"
    />,
  );

  // The dash is decoration; a screen reader gets the sentence instead of it.
  assert.match(html, /<strong aria-hidden="true">—<\/strong>/);
  assert.match(html, /class="visually-hidden">עדיין אין נתון</);
  assert.match(html, /ייפתח לאחר 10 תשובות/);
});
