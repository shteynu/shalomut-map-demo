import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SchoolChoices } from "@/lib/schools/school-options";
import { ManagerOnboarding } from "../manager-onboarding";

/**
 * A link naming a round the current school does not have is usually a link from
 * another school. Until 2026-08-09 this screen's only action was
 * `חזרה למפת הסבב הפעיל`, which returns the manager to the school they are
 * already in — the one place a school switcher is needed and the one place it
 * was absent.
 *
 * Which school the round belongs to is still not looked up and still not shown.
 * The manager's scope is a boundary; the switcher is how they cross it
 * deliberately, not something the screen crosses for them.
 */

const twoSchools: SchoolChoices = {
  options: [
    { id: "org-1", label: "בית ספר אלון — חיפה", isSelected: true },
    { id: "org-2", label: "בית ספר רימון — ירושלים", isSelected: false },
  ],
  roundId: "round-7",
};

function deadEnd(schoolChoices: SchoolChoices | null) {
  return renderToStaticMarkup(
    <ManagerOnboarding
      organizationName="בית ספר אלון"
      state="round-not-found"
      schoolChoices={schoolChoices}
    />,
  );
}

test("the dead end offers the other schools, carrying the round asked for", () => {
  const html = deadEnd(twoSchools);

  assert.match(html, /<select[^>]*name="school"/);
  assert.match(html, /<option[^>]*value="org-2"/);
  assert.match(html, /name="round"[^>]*value="round-7"/);
});

test("choosing a school stays on the screen the link was for", () => {
  // No action, so the GET form submits to the URL it is on — the map link
  // reopens as the map, the tracking link as the tracking screen.
  assert.doesNotMatch(deadEnd(twoSchools), /<form[^>]*action=/);
});

test("the screen says what choosing a school will do", () => {
  assert.match(deadEnd(twoSchools), /אם הקישור הגיע מבית ספר אחר/);
});

test("one school is not a choice, so the dead end grows no switcher", () => {
  const html = deadEnd({
    options: [{ id: "org-1", label: "בית ספר אלון", isSelected: true }],
    roundId: "round-7",
  });

  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /אם הקישור הגיע מבית ספר אחר/);
});

test("without the schools the screen is what it was", () => {
  const html = deadEnd(null);

  assert.doesNotMatch(html, /<select/);
  assert.match(html, /הסבב המבוקש לא נמצא/);
  assert.match(html, /חזרה למפת הסבב הפעיל/);
});

test("the way back to the active round survives beside the switcher", () => {
  assert.match(deadEnd(twoSchools), /חזרה למפת הסבב הפעיל/);
});

test("no other school is named as the one the round belongs to", () => {
  // The list is every school the manager may read, in its usual order. Nothing
  // on the screen says which of them the link came from, because finding that
  // out would mean reading a round outside the manager's current scope.
  const html = deadEnd(twoSchools);

  assert.doesNotMatch(html, /הסבב שייך ל/);
});
