import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SchoolChoices } from "@/lib/schools/school-options";
import { ManagerOnboarding } from "../manager-onboarding";

/**
 * A request that names no school the system has. It is reached by deleting a
 * school under an open session: the remembered choice comes back in a cookie,
 * the value is discarded because that school is gone, and with several schools
 * left the system refuses to pick one.
 *
 * Until 2026-08-09 this screen had no action at all — no switcher and not even
 * the onboarding button, which is suppressed in this state — so the manager
 * could reach it and had nothing to press. The setup screen already answered
 * the same state with a switcher; every other screen sent them here instead.
 */

const twoSchools: SchoolChoices = {
  options: [
    { id: "org-1", label: "בית ספר אלון — חיפה", isSelected: false },
    { id: "org-2", label: "בית ספר רימון — ירושלים", isSelected: false },
  ],
  roundId: "round-7",
};

function scopeRequired(schoolChoices: SchoolChoices | null) {
  return renderToStaticMarkup(
    <ManagerOnboarding state="scope-required" schoolChoices={schoolChoices} />,
  );
}

test("the screen offers the schools it could not choose between", () => {
  const html = scopeRequired(twoSchools);

  assert.match(html, /<select[^>]*name="school"/);
  assert.match(html, /<option[^>]*value="org-1"/);
  assert.match(html, /<option[^>]*value="org-2"/);
});

test("no school is current, so none is offered as if it were", () => {
  // Nothing is selected here — that is the state. A select whose value matches
  // no option would display the first school as the chosen one, and choosing it
  // would fire no change event and go nowhere.
  const html = scopeRequired(twoSchools);

  assert.match(html, /<option value="" disabled[^>]*>בחרו בית ספר<\/option>/);
});

test("choosing a school reopens the screen the manager was on", () => {
  // No action, so the GET form submits to the URL it is on, and the round the
  // request named travels with it.
  const html = scopeRequired(twoSchools);

  assert.doesNotMatch(html, /<form[^>]*action=/);
  assert.match(html, /name="round"[^>]*value="round-7"/);
});

test("with a choice the screen stops reading as somebody else's problem", () => {
  const html = scopeRequired(twoSchools);

  assert.match(html, /בחירת בית ספר/);
  assert.doesNotMatch(html, /פנו למנהל המערכת/);
});

test("without a choice the screen is what it was", () => {
  const html = scopeRequired(null);

  assert.doesNotMatch(html, /<select/);
  assert.match(html, /נדרש שיוך לבית ספר/);
  assert.match(html, /פנו למנהל המערכת/);
});

test("one school is not a choice, so the screen grows no switcher", () => {
  // Unreachable through the service — one school is scoped to rather than asked
  // about — but the screen must not announce a control that renders nothing.
  const html = scopeRequired({
    options: [{ id: "org-1", label: "בית ספר אלון", isSelected: false }],
  });

  assert.doesNotMatch(html, /<select/);
  assert.match(html, /נדרש שיוך לבית ספר/);
});
