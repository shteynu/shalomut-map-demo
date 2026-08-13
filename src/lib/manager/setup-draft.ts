import { describeStaffFloorRefusal } from "@/lib/rounds/staff-floor";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";

/**
 * What a manager has typed into a create dialog, before anything is sent.
 *
 * Both drafts are strings because that is what an input holds; the numbers are
 * parsed here rather than in three separate places, so an empty field and a
 * zero can be told apart and reported differently.
 */
export type RoundDraft = {
  title: string;
  startDate: string;
  endDate: string;
  privacyThreshold: string;
};

export type SchoolDraft = {
  name: string;
  city: string;
  schoolType: string;
  totalStaffCount: string;
};

/**
 * One unmet condition, named against the field that can fix it. The field name
 * is what lets the dialog put the sentence under the input it is about and
 * move focus there, instead of printing a list the manager has to match up to
 * the form by hand.
 */
export type DraftIssue = {
  field: string;
  message: string;
};

function parseWholeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

/** The privacy threshold a draft asks for, or the default when it is unusable. */
export function draftPrivacyThreshold(draft: RoundDraft): number {
  return parseWholeNumber(draft.privacyThreshold) ?? MINIMUM_PRIVACY_THRESHOLD;
}

/** The staff count a draft asks for, or `0` when the field is empty. */
export function draftStaffCount(draft: SchoolDraft): number {
  return parseWholeNumber(draft.totalStaffCount) ?? 0;
}

/**
 * The round half of a create dialog.
 *
 * Every rule here is one the API already enforces — `parsePayload` in
 * `/api/manager/setup` refuses the same values — with one addition the server
 * has no opinion on: an end date before the start date. It is checked because
 * a manager who typed the two dates the wrong way round should be told by the
 * field, not by a tracking screen weeks later that reports a round which
 * closed before it opened.
 */
export function validateRoundDraft(draft: RoundDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];

  if (!draft.title.trim()) {
    issues.push({
      field: "title",
      message: "יש להזין שם לתקופת המדידה, למשל: רבעון א׳.",
    });
  }

  if (!draft.startDate.trim()) {
    issues.push({ field: "startDate", message: "יש לבחור תאריך פתיחה." });
  }

  if (
    draft.startDate.trim() &&
    draft.endDate.trim() &&
    draft.endDate.trim() < draft.startDate.trim()
  ) {
    issues.push({
      field: "endDate",
      message: "תאריך הסיום המתוכנן חל לפני תאריך הפתיחה.",
    });
  }

  const privacyThreshold = parseWholeNumber(draft.privacyThreshold);
  if (privacyThreshold === null || privacyThreshold < MINIMUM_PRIVACY_THRESHOLD) {
    issues.push({
      field: "privacyThreshold",
      message: `סף הפרטיות חייב להיות מספר שלם של ${MINIMUM_PRIVACY_THRESHOLD} משיבים לפחות.`,
    });
  }

  return issues;
}

/**
 * The school half, plus the one rule that spans both halves: a staff smaller
 * than the round's own privacy threshold produces a measurement that can never
 * be shown. The refusal text comes from `staff-floor.ts`, the same function the
 * API answers with, so the dialog and the server can never word it differently.
 */
export function validateSchoolDraft(
  draft: SchoolDraft,
  privacyThreshold: number,
): DraftIssue[] {
  const issues: DraftIssue[] = [];

  if (!draft.name.trim()) {
    issues.push({ field: "name", message: "יש להזין את שם בית הספר." });
  }

  if (!draft.city.trim()) {
    issues.push({ field: "city", message: "יש להזין עיר." });
  }

  if (!draft.schoolType.trim()) {
    issues.push({
      field: "schoolType",
      message: "יש להזין סוג בית ספר, למשל: יסודי.",
    });
  }

  const totalStaffCount = parseWholeNumber(draft.totalStaffCount);
  if (totalStaffCount === null || totalStaffCount < 1) {
    issues.push({
      field: "totalStaffCount",
      message: "יש להזין מספר אנשי צוות (מספר שלם, לפחות 1).",
    });
    return issues;
  }

  const refusal = describeStaffFloorRefusal(totalStaffCount, privacyThreshold);
  if (refusal) {
    issues.push({ field: "totalStaffCount", message: refusal.message });
  }

  return issues;
}

/** The message for a field, or nothing when the field is fine. */
export function issueFor(
  issues: DraftIssue[],
  field: string,
): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}
