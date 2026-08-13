"use client";

import { Building2, Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { FieldIssue } from "@/components/ui/field-issue";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";
import { DEFAULT_AUDIENCE } from "@/lib/audience";
import {
  draftPrivacyThreshold,
  draftStaffCount,
  issueFor,
  validateRoundDraft,
  validateSchoolDraft,
  type DraftIssue,
  type RoundDraft,
  type SchoolDraft,
} from "@/lib/manager/setup-draft";
import { saveManagerSetup } from "@/lib/manager/setup-request";
import { emptyClassesPerGrade } from "@/lib/rounds/grade-labels";
import {
  DEFAULT_PRIVACY_THRESHOLD,
  MINIMUM_PRIVACY_THRESHOLD,
} from "@/lib/survey-definition";

/**
 * Opening a school.
 *
 * A school arrives with its first round — there is no school in this product
 * without one — so the dialog asks for both, and says so. What it does not ask
 * for is the twenty background numbers the setup screen collects: none of them
 * are needed to open a school, all of them are editable afterwards, and asking
 * for them at this moment is what made adding a school feel like a form to
 * survive rather than a decision to take.
 */
export function NewSchoolDialog({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called with the school the save opened. Moving the manager into it is the
   * caller's job: this dialog states what will happen and performs the write.
   */
  onCreated: (organizationId: string | undefined) => void;
}) {
  const [school, setSchool] = useState<SchoolDraft>({
    name: "",
    city: "",
    schoolType: "",
    totalStaffCount: "",
  });
  const [round, setRound] = useState<RoundDraft>(() => ({
    title: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    privacyThreshold: String(DEFAULT_PRIVACY_THRESHOLD),
  }));
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [showIssues, setShowIssues] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fieldPrefix = useId();

  function fieldId(field: string) {
    return `${fieldPrefix}-${field}`;
  }

  function collect(nextSchool: SchoolDraft, nextRound: RoundDraft) {
    return [
      ...validateSchoolDraft(nextSchool, draftPrivacyThreshold(nextRound)),
      ...validateRoundDraft(nextRound),
    ];
  }

  function updateSchool(field: keyof SchoolDraft, value: string) {
    const next = { ...school, [field]: value };
    setSchool(next);
    setError(null);
    setIssues(collect(next, round));
  }

  function updateRound(field: keyof RoundDraft, value: string) {
    const next = { ...round, [field]: value };
    setRound(next);
    setError(null);
    setIssues(collect(school, next));
  }

  const privacyThreshold = draftPrivacyThreshold(round);
  const blocking = showIssues ? issues : [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found = collect(school, round);
    setIssues(found);
    setShowIssues(true);

    if (found.length > 0) {
      const first = found[0]?.field;
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    const outcome = await saveManagerSetup({
      // Said out loud, because the API scopes an unnamed organization to the
      // school the request is already in. Without it this would overwrite the
      // school the manager came from.
      createOrganization: true,
      organization: {
        name: school.name.trim(),
        city: school.city.trim(),
        schoolType: school.schoolType.trim(),
        totalStaffCount: draftStaffCount(school),
      },
      round: {
        title: round.title.trim(),
        startDate: round.startDate,
        endDate: round.endDate,
        privacyThreshold,
        backgroundContext: {
          notes: "",
          audience: DEFAULT_AUDIENCE,
          sicknessDaysThisQuarter: 0,
          newStaffMembers: 0,
          studentCount: 0,
          socioEconomicIndex: 1,
          classesPerGrade: emptyClassesPerGrade(),
        },
      },
    });

    if (!outcome.ok) {
      setError(outcome.error);
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
    onCreated(outcome.organizationId);
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      title="הוספת בית ספר"
      onClose={onClose}
      initialFocusRef={nameRef}
      description="בית ספר נפתח יחד עם סבב האבחון הראשון שלו. לאחר השמירה כל המסכים יוצגו עבור בית הספר החדש, ואפשר יהיה להשלים את נתוני הרקע במסך הגדרת הסבב."
    >
      {blocking.length > 0 ? (
        <section className="survey-submit-error" aria-live="polite">
          <strong>כדי לפתוח את בית הספר:</strong>
          <ul>
            {blocking.map((issue) => (
              <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p className="survey-submit-error" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="modal-dialog-form">
        <fieldset className="modal-dialog-fieldset">
          <legend>פרטי בית הספר</legend>
          <div className="modal-dialog-grid">
            <label htmlFor={fieldId("name")}>
              שם בית הספר
              <input
                id={fieldId("name")}
                ref={nameRef}
                value={school.name}
                onChange={(event) => updateSchool("name", event.target.value)}
                aria-invalid={Boolean(issueFor(blocking, "name"))}
                aria-describedby={
                  issueFor(blocking, "name") ? fieldId("name-issue") : undefined
                }
              />
              <FieldIssue
                id={fieldId("name-issue")}
                message={issueFor(blocking, "name")}
              />
            </label>

            <label htmlFor={fieldId("city")}>
              עיר
              <input
                id={fieldId("city")}
                value={school.city}
                onChange={(event) => updateSchool("city", event.target.value)}
                aria-invalid={Boolean(issueFor(blocking, "city"))}
                aria-describedby={
                  issueFor(blocking, "city") ? fieldId("city-issue") : undefined
                }
              />
              <FieldIssue
                id={fieldId("city-issue")}
                message={issueFor(blocking, "city")}
              />
            </label>

            <label htmlFor={fieldId("schoolType")}>
              סוג בית הספר
              <input
                id={fieldId("schoolType")}
                value={school.schoolType}
                onChange={(event) =>
                  updateSchool("schoolType", event.target.value)
                }
                placeholder="יסודי"
                aria-invalid={Boolean(issueFor(blocking, "schoolType"))}
                aria-describedby={
                  issueFor(blocking, "schoolType")
                    ? fieldId("schoolType-issue")
                    : undefined
                }
              />
              <FieldIssue
                id={fieldId("schoolType-issue")}
                message={issueFor(blocking, "schoolType")}
              />
            </label>

            <label htmlFor={fieldId("totalStaffCount")}>
              מספר אנשי צוות
              <input
                id={fieldId("totalStaffCount")}
                type="number"
                min="1"
                value={school.totalStaffCount}
                onChange={(event) =>
                  updateSchool("totalStaffCount", event.target.value)
                }
                aria-invalid={Boolean(issueFor(blocking, "totalStaffCount"))}
                aria-describedby={
                  issueFor(blocking, "totalStaffCount")
                    ? fieldId("totalStaffCount-issue")
                    : undefined
                }
              />
              <FieldIssue
                id={fieldId("totalStaffCount-issue")}
                message={issueFor(blocking, "totalStaffCount")}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="modal-dialog-fieldset">
          <legend>סבב האבחון הראשון</legend>
          <label htmlFor={fieldId("title")}>
            תקופת המדידה
            <input
              id={fieldId("title")}
              value={round.title}
              onChange={(event) => updateRound("title", event.target.value)}
              placeholder="רבעון א׳"
              aria-invalid={Boolean(issueFor(blocking, "title"))}
              aria-describedby={
                issueFor(blocking, "title") ? fieldId("title-issue") : undefined
              }
            />
            <FieldIssue
              id={fieldId("title-issue")}
              message={issueFor(blocking, "title")}
            />
          </label>

          <div className="modal-dialog-grid">
            <label htmlFor={fieldId("startDate")}>
              תאריך פתיחה
              <input
                id={fieldId("startDate")}
                type="date"
                value={round.startDate}
                onChange={(event) =>
                  updateRound("startDate", event.target.value)
                }
                aria-invalid={Boolean(issueFor(blocking, "startDate"))}
                aria-describedby={
                  issueFor(blocking, "startDate")
                    ? fieldId("startDate-issue")
                    : undefined
                }
              />
              <FieldIssue
                id={fieldId("startDate-issue")}
                message={issueFor(blocking, "startDate")}
              />
            </label>

            <label htmlFor={fieldId("privacyThreshold")}>
              <span style={{ display: "inline-flex", alignItems: "center" }}>
                סף פרטיות
                <PrivacyTooltip minimumResponses={privacyThreshold} />
              </span>
              <input
                id={fieldId("privacyThreshold")}
                type="number"
                min={MINIMUM_PRIVACY_THRESHOLD}
                value={round.privacyThreshold}
                onChange={(event) =>
                  updateRound("privacyThreshold", event.target.value)
                }
                aria-invalid={Boolean(issueFor(blocking, "privacyThreshold"))}
                aria-describedby={
                  issueFor(blocking, "privacyThreshold")
                    ? fieldId("privacyThreshold-issue")
                    : undefined
                }
              />
              <FieldIssue
                id={fieldId("privacyThreshold-issue")}
                message={issueFor(blocking, "privacyThreshold")}
              />
            </label>
          </div>
        </fieldset>

        <div className="modal-dialog-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Building2 size={18} aria-hidden="true" />
            )}
            {saving ? "פותח בית ספר..." : "פתיחת בית הספר"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
