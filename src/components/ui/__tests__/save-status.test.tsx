import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SaveStatus, parseSavedAt } from "../save-status";

// Today, because "at 14:03" is only the whole truth for work saved today. The
// instant is taken from the clock rather than written down, so the test does not
// start failing the day after it was written.
const savedAt = new Date();

test("nothing is said before anything has happened", () => {
  const markup = renderToStaticMarkup(
    <SaveStatus savedAt={null} hasUnsavedChanges={false} />,
  );

  assert.strictEqual(markup, "");
});

test("a completed save says when it happened", () => {
  const markup = renderToStaticMarkup(
    <SaveStatus savedAt={savedAt} hasUnsavedChanges={false} />,
  );

  assert.ok(markup.includes("נשמר בשעה"));
  assert.ok(markup.includes(savedAt.toISOString()));
  assert.ok(markup.includes('role="status"'));
  assert.ok(!markup.includes("טרם נשמרו"));
});

test("a save from another day is dated, not left reading as this morning", () => {
  const earlier = new Date(savedAt.getTime() - 3 * 24 * 60 * 60 * 1000);
  const markup = renderToStaticMarkup(
    <SaveStatus savedAt={earlier} hasUnsavedChanges={false} />,
  );

  // A stored save time arrives with the page and can be days old, so the hour
  // alone would be a claim about today that nobody made.
  assert.ok(markup.includes("נשמר ב"));
  assert.ok(!markup.includes("נשמר בשעה"));
  assert.ok(markup.includes(earlier.toISOString()));
  assert.ok(
    markup.includes(
      new Intl.DateTimeFormat("he-IL", {
        dateStyle: "long",
        timeZone: "Asia/Jerusalem",
      }).format(earlier),
    ),
  );
});

test("an edit after the save stops the time from reading as current", () => {
  const markup = renderToStaticMarkup(
    <SaveStatus savedAt={savedAt} hasUnsavedChanges />,
  );

  // The time stays — it is a fact about the last write — but it is no longer
  // the state of the screen, and the line says so first.
  assert.ok(markup.includes("יש שינויים שטרם נשמרו"));
  assert.ok(markup.includes("שמירה אחרונה בשעה"));
  assert.ok(markup.includes(savedAt.toISOString()));
});

test("edits before any save say so without inventing a time", () => {
  const markup = renderToStaticMarkup(
    <SaveStatus savedAt={null} hasUnsavedChanges />,
  );

  assert.ok(markup.includes("יש שינויים שטרם נשמרו"));
  assert.ok(!markup.includes("שמירה אחרונה"));
  assert.ok(!markup.includes("<time"));
});

test("the state is never carried by colour alone", () => {
  const saved = renderToStaticMarkup(
    <SaveStatus savedAt={savedAt} hasUnsavedChanges={false} />,
  );
  const pending = renderToStaticMarkup(
    <SaveStatus savedAt={savedAt} hasUnsavedChanges />,
  );

  // Different words and different icons, so the two survive a monochrome or
  // high-contrast rendering.
  assert.notStrictEqual(saved, pending);
  assert.ok(saved.includes("<svg"));
  assert.ok(pending.includes("<svg"));
});

test("a server that reports no time is not covered for with a made-up one", () => {
  assert.strictEqual(parseSavedAt(undefined), null);
  assert.strictEqual(parseSavedAt(""), null);
  assert.strictEqual(parseSavedAt("not a date"), null);
  assert.strictEqual(parseSavedAt(1785832269904), null);
});

test("a reported time is read as the instant the server named", () => {
  const parsed = parseSavedAt(savedAt.toISOString());

  assert.ok(parsed instanceof Date);
  assert.strictEqual(parsed.getTime(), savedAt.getTime());
});
