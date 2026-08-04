import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CopyLinkStatus } from "../copy-link-status";

test("nothing is said before a copy is attempted", () => {
  const markup = renderToStaticMarkup(
    <CopyLinkStatus status="idle" successText="הלינק הועתק." />,
  );

  assert.strictEqual(markup, "");
});

test("a successful copy says so once, politely", () => {
  const markup = renderToStaticMarkup(
    <CopyLinkStatus status="copied" successText="הלינק הועתק." />,
  );

  assert.ok(markup.includes("הלינק הועתק."));
  assert.ok(markup.includes('role="status"'));
});

test("a blocked clipboard says what happened and what to do instead", () => {
  const markup = renderToStaticMarkup(
    <CopyLinkStatus status="failed" successText="הלינק הועתק." />,
  );

  assert.ok(!markup.includes("הלינק הועתק."));
  assert.ok(markup.includes("חסם את ההעתקה"));
  assert.ok(markup.includes("Ctrl+C"));
  assert.ok(markup.includes('role="alert"'));
});
