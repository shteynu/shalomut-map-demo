import assert from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { BackgroundNoteWarning } from "../background-note-warning";

/**
 * The background note is the only free text a manager writes that leaves this
 * platform: on contract 4.0 and above it reaches the model's prompt verbatim.
 * Until 2026-08-22 the field said nothing about that, so "our counsellor has
 * been on sick leave since March" went to a subprocessor from a screen that
 * looked entirely internal.
 */

test("the warning says the note leaves the platform, and says not to name people", () => {
  const html = renderToStaticMarkup(<BackgroundNoteWarning />);

  assert.match(html, /יוצאת מהפלטפורמה/);
  assert.match(html, /נשלחת כלשונה למודל/);
  assert.match(html, /שמות של אנשי צוות/);
});

test("it carries the id the textarea points at", () => {
  // A note a screen reader never reaches is a note the person typing does not
  // have, so the id is part of the component rather than of the page around it.
  const html = renderToStaticMarkup(
    <BackgroundNoteWarning id="setup-notes-note" />,
  );

  assert.match(html, /id="setup-notes-note"/);
});

test("the setup form points its background note field at that id", () => {
  // The other half of the pair, read from the source rather than rendered:
  // `SetupForm` needs the app router, and a router harness for one attribute
  // would be more machinery than the attribute.
  const source = readFileSync(
    new URL("../setup-form.tsx", import.meta.url),
    "utf-8",
  );

  const textarea = /<textarea[\s\S]*?name="notes"[\s\S]*?\/>/.exec(source);
  assert.ok(textarea, "the background note field is gone");
  assert.match(textarea[0], /aria-describedby="setup-notes-note"/);
  assert.match(source, /<BackgroundNoteWarning id="setup-notes-note" \/>/);
});
