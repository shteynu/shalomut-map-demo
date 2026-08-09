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
  assert.match(html, /<noscript>[\s\S]*<button[^>]*type="submit"/);
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

/**
 * The dead end for a link into a round the current school does not have is the
 * one screen outside setup that offers this switcher, and it wants the choice
 * to land back where the manager already is rather than on the setup screen.
 */
function renderRetrySwitcher(roundId?: string) {
  return renderToStaticMarkup(
    <SchoolSwitcher
      options={toSchoolSwitcherOptions(twoSchools, "org-1")}
      action={null}
      roundId={roundId}
    />,
  );
}

test("a switcher given no action submits to the screen it is on", () => {
  const html = renderRetrySwitcher();

  // No action at all, rather than a path: the same markup is rendered by the
  // map, the tracking screen and the builder, and each wants its own URL.
  assert.doesNotMatch(html, /<form[^>]*action=/);
  assert.match(html, /<form[^>]*method="get"/);
});

test("the round survives the switch, because a GET form replaces the query", () => {
  const html = renderRetrySwitcher("round-7");

  assert.match(html, /<input[^>]*type="hidden"[^>]*name="round"[^>]*value="round-7"/);
});

test("a switcher with no round to carry adds no empty parameter", () => {
  assert.doesNotMatch(renderRetrySwitcher(), /type="hidden"/);
});
