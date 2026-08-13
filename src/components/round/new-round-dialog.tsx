"use client";

import { CalendarPlus, Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { FieldIssue } from "@/components/ui/field-issue";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";
import {
  draftPrivacyThreshold,
  issueFor,
  validateRoundDraft,
  type DraftIssue,
  type RoundDraft,
} from "@/lib/manager/setup-draft";
import { saveManagerSetup } from "@/lib/manager/setup-request";
import { emptyClassesPerGrade } from "@/lib/rounds/grade-labels";
import { describeStaffFloorRefusal } from "@/lib/rounds/staff-floor";
import { DEFAULT_AUDIENCE } from "@/lib/audience";
import {
  DEFAULT_PRIVACY_THRESHOLD,
  MINIMUM_PRIVACY_THRESHOLD,
} from "@/lib/survey-definition";
import type { RoundBackgroundContext } from "@/lib/types/backend";

type NewRoundDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called with the round the save opened. Where to go next is the caller's to
   * decide, not this dialog's — and a dialog that reaches for the router is a
   * dialog that cannot be rendered outside one.
   */
  onCreated: (roundId: string | undefined) => void;
  /** The school the round is being opened for; it is saved unchanged. */
  organization: {
    id: string;
    name: string;
    city: string;
    schoolType: string;
    totalStaffCount: number;
  };
  /**
   * The round the school is running, if any. Its background numbers carry over
   * to the new round: the staff, the students and the classes are the same
   * school a quarter later, and a manager who has to retype twenty numbers to
   * open a round will not open one.
   */
  previousRound?: {
    privacyThreshold: number;
    backgroundContext?: RoundBackgroundContext;
  } | null;
};

function defaultBackgroundContext(
  previous: RoundBackgroundContext | undefined,
): RoundBackgroundContext {
  return {
    // The note is about the round that had it, not about this one.
    notes: "",
    audience: previous?.audience ?? DEFAULT_AUDIENCE,
    sicknessDaysThisQuarter: previous?.sicknessDaysThisQuarter ?? 0,
    newStaffMembers: previous?.newStaffMembers ?? 0,
    studentCount: previous?.studentCount ?? 0,
    socioEconomicIndex: previous?.socioEconomicIndex ?? 1,
    classesPerGrade: previous?.classesPerGrade ?? emptyClassesPerGrade(),
  };
}

/**
 * Opening the school's next round.
 *
 * It used to be a link into `/setup?round=new`, which is the same forty-field
 * screen the current round is edited in, distinguished from it by the wording
 * of a button below the fold. Two things were unreadable there: that this was
 * a creation rather than an edit, and what would happen to the round already
 * running. Both are said here, and the dialog asks only for what actually
 * differs between two rounds of the same school.
 */
export function NewRoundDialog({
  isOpen,
  onClose,
  onCreated,
  organization,
  previousRound,
}: NewRoundDialogProps) {
  const [draft, setDraft] = useState<RoundDraft>(() => ({
    title: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    privacyThreshold: String(
      previousRound?.privacyThreshold ?? DEFAULT_PRIVACY_THRESHOLD,
    ),
  }));
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [showIssues, setShowIssues] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fieldPrefix = useId();

  function fieldId(field: string) {
    return `${fieldPrefix}-${field}`;
  }

  function update(field: keyof RoundDraft, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setError(null);
    // Recomputed on every keystroke, but only shown once the manager has asked
    // to open the round: a dialog that turns red while the first field is
    // still being typed reads as a rejection of the work in progress.
    setIssues(validateRoundDraft(next));
  }

  const privacyThreshold = draftPrivacyThreshold(draft);
  // The school is not editable here, so a staff below the threshold is a
  // reason to change the threshold rather than the staff — which is why it is
  // said next to that field and not next to a staff input this dialog has not
  // got.
  const staffFloorRefusal = describeStaffFloorRefusal(
    organization.totalStaffCount,
    privacyThreshold,
  );
  const blocking = showIssues ? issues : [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found = validateRoundDraft(draft);
    setIssues(found);
    setShowIssues(true);

    if (found.length > 0 || staffFloorRefusal) {
      // Focus goes to the first field that can fix something, so the list at
      // the top is a summary rather than the only place the answer lives.
      const first = found[0]?.field;
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    const outcome = await saveManagerSetup({
      createOrganization: false,
      organization: {
        id: organization.id,
        name: organization.name,
        city: organization.city,
        schoolType: organization.schoolType,
        totalStaffCount: organization.totalStaffCount,
      },
      round: {
        // No id: this is the write that opens a round.
        title: draft.title.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        privacyThreshold,
        backgroundContext: defaultBackgroundContext(
          previousRound?.backgroundContext,
        ),
      },
    });

    if (!outcome.ok) {
      setError(outcome.error);
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
    onCreated(outcome.roundId);
  }

  return (
    <ModalDialog
      isOpen={isOpen}
      title="פתיחת סבב אבחון חדש"
      onClose={onClose}
      initialFocusRef={titleRef}
      description={
        <>
          הסבב החדש נפתח עבור <strong>{organization.name}</strong> כטיוטה, עם
          שאלון השלומות המלא. לכל סבב יש שאלון אחד בלבד. הסבב הנוכחי ימשיך לאסוף
          תשובות עד שתשמרו את השאלון החדש במסך בניית השאלון — השמירה שם היא
          שמעלה את הסבב החדש לאוויר ומסמנת את הקודם כסגור.
        </>
      }
    >
      {blocking.length > 0 ? (
        <section className="survey-submit-error" aria-live="polite">
          <strong>כדי לפתוח את הסבב:</strong>
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
        <label htmlFor={fieldId("title")}>
          תקופת המדידה
          <input
            id={fieldId("title")}
            ref={titleRef}
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="רבעון א׳"
            aria-describedby={
              issueFor(blocking, "title") ? fieldId("title-issue") : undefined
            }
            aria-invalid={Boolean(issueFor(blocking, "title"))}
          />
          <FieldIssue id={fieldId("title-issue")} message={issueFor(blocking, "title")} />
        </label>

        <div className="modal-dialog-grid">
          <label htmlFor={fieldId("startDate")}>
            תאריך פתיחה
            <input
              id={fieldId("startDate")}
              type="date"
              value={draft.startDate}
              onChange={(event) => update("startDate", event.target.value)}
              aria-describedby={
                issueFor(blocking, "startDate")
                  ? fieldId("startDate-issue")
                  : undefined
              }
              aria-invalid={Boolean(issueFor(blocking, "startDate"))}
            />
            <FieldIssue
              id={fieldId("startDate-issue")}
              message={issueFor(blocking, "startDate")}
            />
          </label>

          <label htmlFor={fieldId("endDate")}>
            תאריך סיום מתוכנן (רשות)
            <input
              id={fieldId("endDate")}
              type="date"
              value={draft.endDate}
              onChange={(event) => update("endDate", event.target.value)}
              aria-describedby={
                issueFor(blocking, "endDate")
                  ? fieldId("endDate-issue")
                  : undefined
              }
              aria-invalid={Boolean(issueFor(blocking, "endDate"))}
            />
            <FieldIssue
              id={fieldId("endDate-issue")}
              message={issueFor(blocking, "endDate")}
            />
          </label>
        </div>

        <label htmlFor={fieldId("privacyThreshold")}>
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            סף פרטיות (מינימום להצגת תוצאות)
            <PrivacyTooltip minimumResponses={privacyThreshold} />
          </span>
          <input
            id={fieldId("privacyThreshold")}
            type="number"
            min={MINIMUM_PRIVACY_THRESHOLD}
            value={draft.privacyThreshold}
            onChange={(event) => update("privacyThreshold", event.target.value)}
            aria-describedby={
              issueFor(blocking, "privacyThreshold") || staffFloorRefusal
                ? fieldId("privacyThreshold-issue")
                : undefined
            }
            aria-invalid={Boolean(
              issueFor(blocking, "privacyThreshold") || staffFloorRefusal,
            )}
          />
          <FieldIssue
            id={fieldId("privacyThreshold-issue")}
            message={
              issueFor(blocking, "privacyThreshold") ??
              staffFloorRefusal?.message
            }
          />
        </label>

        <p className="quiet-note">
          שאר נתוני הרקע — מספר אנשי הצוות, התלמידים והכיתות — נשמרים כפי שהם
          בבית הספר, וניתן לעדכן אותם במסך הגדרת הסבב לאחר הפתיחה.
        </p>

        <div className="modal-dialog-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <CalendarPlus size={18} aria-hidden="true" />
            )}
            {saving ? "פותח סבב..." : "פתיחת הסבב"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

