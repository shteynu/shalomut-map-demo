import assert from "node:assert";
import test from "node:test";
import {
  draftPrivacyThreshold,
  draftStaffCount,
  issueFor,
  validateRoundDraft,
  validateSchoolDraft,
  type RoundDraft,
  type SchoolDraft,
} from "@/lib/manager/setup-draft";
import { describeStaffFloorRefusal } from "@/lib/rounds/staff-floor";
import {
  DEFAULT_PRIVACY_THRESHOLD,
  MINIMUM_PRIVACY_THRESHOLD,
} from "@/lib/survey-definition";

/**
 * What a create dialog will and will not accept.
 *
 * The complaint these rules answer is not that a round could be opened with
 * bad values — the API refused those already — but that the refusal arrived as
 * a button that did nothing, with no sentence attached to any field. So every
 * assertion here is about a message being produced and about which field it is
 * aimed at, not only about the count of problems.
 */

const LATIN = /[A-Za-z]/u;

function roundDraft(overrides: Partial<RoundDraft> = {}): RoundDraft {
  return {
    title: "רבעון א׳",
    startDate: "2026-09-01",
    endDate: "",
    privacyThreshold: String(DEFAULT_PRIVACY_THRESHOLD),
    ...overrides,
  };
}

function schoolDraft(overrides: Partial<SchoolDraft> = {}): SchoolDraft {
  return {
    name: "בית ספר הדס",
    city: "חיפה",
    schoolType: "יסודי",
    totalStaffCount: "40",
    ...overrides,
  };
}

test("a complete round draft has nothing to report", () => {
  assert.deepStrictEqual(validateRoundDraft(roundDraft()), []);
});

test("each missing round field names itself, in Hebrew", () => {
  const issues = validateRoundDraft(
    roundDraft({ title: "   ", startDate: "" }),
  );

  assert.strictEqual(issues.length, 2);
  assert.ok(issueFor(issues, "title"));
  assert.ok(issueFor(issues, "startDate"));
  for (const issue of issues) {
    assert.doesNotMatch(issue.message, LATIN, issue.field);
  }
});

test("a round that would close before it opened is refused on the end date", () => {
  const issues = validateRoundDraft(
    roundDraft({ startDate: "2026-09-01", endDate: "2026-08-31" }),
  );

  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].field, "endDate");

  // The same two dates the right way round, and the equal case, are fine: a
  // round that opens and closes on one day is short, not wrong.
  assert.deepStrictEqual(
    validateRoundDraft(
      roundDraft({ startDate: "2026-08-31", endDate: "2026-09-01" }),
    ),
    [],
  );
  assert.deepStrictEqual(
    validateRoundDraft(
      roundDraft({ startDate: "2026-09-01", endDate: "2026-09-01" }),
    ),
    [],
  );
});

test("the privacy threshold is a whole number, and never below the minimum", () => {
  for (const value of ["", "abc", "9.5", String(MINIMUM_PRIVACY_THRESHOLD - 1)]) {
    const issues = validateRoundDraft(roundDraft({ privacyThreshold: value }));
    assert.ok(issueFor(issues, "privacyThreshold"), value);
  }

  assert.deepStrictEqual(
    validateRoundDraft(
      roundDraft({ privacyThreshold: String(MINIMUM_PRIVACY_THRESHOLD) }),
    ),
    [],
  );
});

test("an unusable threshold field still reports the product's minimum, not NaN", () => {
  // The dialog prints this number back in its own privacy explanation, so it
  // has to be a number whatever the field holds mid-edit.
  assert.strictEqual(
    draftPrivacyThreshold(roundDraft({ privacyThreshold: "" })),
    MINIMUM_PRIVACY_THRESHOLD,
  );
  assert.strictEqual(
    draftPrivacyThreshold(roundDraft({ privacyThreshold: "nonsense" })),
    MINIMUM_PRIVACY_THRESHOLD,
  );
  assert.strictEqual(draftStaffCount(schoolDraft({ totalStaffCount: "" })), 0);
});

test("a complete school draft has nothing to report", () => {
  assert.deepStrictEqual(validateSchoolDraft(schoolDraft(), 10), []);
});

test("a staff smaller than the round's own threshold is refused in the API's words", () => {
  const issues = validateSchoolDraft(schoolDraft({ totalStaffCount: "6" }), 10);

  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].field, "totalStaffCount");
  // The same sentence the route answers with, so the dialog and the server can
  // never word the same refusal differently.
  assert.strictEqual(
    issues[0].message,
    describeStaffFloorRefusal(6, 10)?.message,
  );
});

test("an empty staff field is an unfilled field, not a school too small to measure", () => {
  const issues = validateSchoolDraft(schoolDraft({ totalStaffCount: "" }), 10);

  assert.strictEqual(issues.length, 1);
  assert.notStrictEqual(issues[0].message, describeStaffFloorRefusal(0, 10)?.message);
  assert.doesNotMatch(issues[0].message, LATIN);
});

test("issueFor answers for the field asked about and no other", () => {
  const issues = validateSchoolDraft(
    schoolDraft({ name: "", city: "" }),
    10,
  );

  assert.ok(issueFor(issues, "name"));
  assert.ok(issueFor(issues, "city"));
  assert.strictEqual(issueFor(issues, "schoolType"), undefined);
});
