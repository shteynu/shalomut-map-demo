import assert from "node:assert";
import test from "node:test";
import { toSchoolSwitcherOptions } from "../school-options";
import type { Organization } from "@/lib/types/backend";

function school(
  id: string,
  name: string,
  city: string,
  createdAt: string,
): Organization {
  return {
    id,
    name,
    city,
    schoolType: "יסודי",
    totalStaffCount: 30,
    createdAt: new Date(createdAt),
  };
}

const schools = [
  school("org-2", "בית ספר רימון", "ירושלים", "2026-07-20T00:00:00.000Z"),
  school("org-1", "בית ספר אלון", "חיפה", "2026-07-01T00:00:00.000Z"),
];

test("the schools read by name, not by the order they were opened in", () => {
  const options = toSchoolSwitcherOptions(schools, "org-1");

  assert.deepStrictEqual(
    options.map((option) => option.id),
    ["org-1", "org-2"],
  );
});

test("the city is part of the label, so two schools sharing a name stay apart", () => {
  const sameName = [
    school("org-1", "בית ספר אלון", "חיפה", "2026-07-01T00:00:00.000Z"),
    school("org-2", "בית ספר אלון", "ירושלים", "2026-07-20T00:00:00.000Z"),
  ];

  const labels = toSchoolSwitcherOptions(sameName, "org-1").map(
    (option) => option.label,
  );

  assert.strictEqual(new Set(labels).size, 2);
  assert.ok(labels.every((label) => label.includes("בית ספר אלון")));
});

test("the school on screen is the one marked selected", () => {
  const options = toSchoolSwitcherOptions(schools, "org-2");

  assert.deepStrictEqual(
    options.filter((option) => option.isSelected).map((option) => option.id),
    ["org-2"],
  );
});

test("no school chosen yet marks none of them", () => {
  const options = toSchoolSwitcherOptions(schools, undefined);

  assert.ok(options.every((option) => !option.isSelected));
});
