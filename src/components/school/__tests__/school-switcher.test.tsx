import assert from "node:assert";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { toSchoolSwitcherOptions } from "@/lib/schools/school-options";
import type { Organization } from "@/lib/types/backend";
import { SchoolSwitcher } from "../school-switcher";

function school(id: string, name: string, city: string): Organization {
  return {
    id,
    name,
    city,
    schoolType: "יסודי",
    totalStaffCount: 30,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
  };
}

const twoSchools = [
  school("org-1", "בית ספר אלון", "חיפה"),
  school("org-2", "בית ספר רימון", "ירושלים"),
];

function renderSwitcher(
  schools: Organization[],
  selectedId: string | undefined,
  isNewSchool = false,
) {
  return renderToStaticMarkup(
    <SchoolSwitcher
      options={toSchoolSwitcherOptions(schools, selectedId)}
      isNewSchool={isNewSchool}
    />,
  );
}

test("one school is not a choice, so nothing is rendered", () => {
  const html = renderSwitcher([twoSchools[0]], "org-1");

  assert.strictEqual(html, "");
});

test("several schools are one select whose value is the school on screen", () => {
  const html = renderSwitcher(twoSchools, "org-2");

  assert.match(html, /<select[^>]*name="school"/);
  assert.match(html, /<option[^>]*value="org-1"/);
  assert.match(html, /<option[^>]*value="org-2"[^>]*selected/);
});

test("choosing a school submits to the setup screen, with or without scripting", () => {
  const html = renderSwitcher(twoSchools, "org-1");

  assert.match(html, /<form[^>]*action="\/setup"[^>]*method="get"/);
  assert.match(html, /<noscript>.*<button[^>]*type="submit"/s);
});

test("the school being opened is offered only while it is being opened", () => {
  const opening = renderSwitcher(twoSchools, undefined, true);
  const settled = renderSwitcher(twoSchools, "org-1");

  assert.match(opening, /<option[^>]*value="new"[^>]*selected/);
  assert.doesNotMatch(settled, /value="new"/);
});

test("opening a second school keeps the way back to the first one", () => {
  const html = renderSwitcher([twoSchools[0]], undefined, true);

  assert.match(html, /<option[^>]*value="org-1"/);
});
