"use client";

import Link from "next/link";
import { Building2, CalendarPlus, Check, ChevronLeft, ClipboardPen, Lightbulb, Loader2, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type MouseEvent, useId, useState } from "react";
import { NewRoundDialog } from "@/components/round/new-round-dialog";
import { NewSchoolDialog } from "@/components/school/new-school-dialog";
import {
  StaffFloorWarning,
  staffFloorWarningText,
} from "@/components/round/staff-floor-warning";
import { PrivacyThresholdNotice } from "@/components/ui/privacy-threshold-notice";
import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";
import { SaveStatus, parseSavedAt } from "@/components/ui/save-status";
import { AUDIENCE_OPTIONS, DEFAULT_AUDIENCE } from "@/lib/audience";
import {
  getNavigationAction,
  newRoundSetupRoute,
  newSchoolSetupRoute,
  schoolSetupRoute,
  surveyBuilderRoute,
} from "@/lib/navigation";
import { GRADE_LABELS } from "@/lib/rounds/grade-labels";
import {
  DEFAULT_PRIVACY_THRESHOLD,
  MINIMUM_PRIVACY_THRESHOLD,
} from "@/lib/survey-definition";

type SetupFormProps = {
  /** Opening a round the school does not have yet rather than editing one. */
  isNewRound?: boolean;
  /**
   * Opening a school the system does not have yet. The form is the same one,
   * because a school arrives with its first round and both are filled in here.
   */
  isNewSchool?: boolean;
  /** Whether offering a second round makes sense: a school with a round. */
  canOpenNewRound?: boolean;
  /** Whether offering a second school makes sense: a school already saved. */
  canOpenNewSchool?: boolean;
  organization: {
    id: string;
    name: string;
    city: string;
    schoolType: string;
    totalStaffCount: number;
  } | null;
  round: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    privacyThreshold: number;
    /** When this round last reached the database, as the round records it. */
    updatedAt?: string;
    backgroundContext?: {
      notes: string;
      audience: string;
      sicknessDaysThisQuarter: number;
      newStaffMembers: number;
      studentCount: number;
      socioEconomicIndex: number;
      classesPerGrade: Record<string, number>;
    };
  } | null;
};

const gradeLabels = GRADE_LABELS;

/**
 * A link that opens a dialog when it can, and navigates when it cannot.
 *
 * Creating a school or a round is a dialog now, but the screens behind those
 * URLs still work and are still the way through without JavaScript — and a
 * modifier-click is a request for a new tab, not for a dialog in this one.
 */
function openInDialog(
  event: MouseEvent<HTMLAnchorElement>,
  open: () => void,
) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  open();
}

export function SetupForm({
  isNewRound = false,
  isNewSchool = false,
  canOpenNewRound = false,
  canOpenNewSchool = false,
  organization,
  round,
}: SetupFormProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // When the server confirmed the write, and whether the form has moved since.
  // The fields are uncontrolled, so any input is what marks the form dirty.
  // It starts at the round's stored save time, which is what carries the answer
  // across a reload; a new round has none to show yet.
  const [savedAt, setSavedAt] = useState<Date | null>(() =>
    parseSavedAt(round?.updatedAt),
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedRoundId, setSavedRoundId] = useState<string | null>(null);
  // Set once this screen has actually opened the school it is filling in, for
  // the same reason as `savedRoundId` below: the navigation away happens after
  // the response, so a second submit in the meantime must edit the school that
  // now exists rather than open another one under the same name.
  const [savedOrganizationId, setSavedOrganizationId] = useState<string | null>(
    null,
  );
  const [minimumResponses, setMinimumResponses] = useState(
    round?.privacyThreshold ?? DEFAULT_PRIVACY_THRESHOLD,
  );
  // Controlled unlike its neighbours, because the round the server refuses —
  // a staff smaller than its own privacy threshold — is worth saying while the
  // manager is still typing rather than only after they press save.
  const [totalStaffCount, setTotalStaffCount] = useState(
    organization?.totalStaffCount ? String(organization.totalStaffCount) : "",
  );
  const [isNewRoundDialogOpen, setNewRoundDialogOpen] = useState(false);
  const [isNewSchoolDialogOpen, setNewSchoolDialogOpen] = useState(false);
  const staffFloorWarningId = useId();
  const staffFloorWarning = staffFloorWarningText(
    Number(totalStaffCount),
    minimumResponses,
  );
  const router = useRouter();
  const distributeSurveyAction = getNavigationAction("distributeSurvey");
  // A new round is a draft while the round the school is collecting on is still
  // the active one, so its builder link has to name it. Without the id the
  // builder would open the running round and the manager would edit the wrong
  // questionnaire.
  const builderHref =
    (isNewRound || isNewSchool) && savedRoundId
      ? surveyBuilderRoute(savedRoundId)
      : distributeSurveyAction.href;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const classesPerGrade = Object.fromEntries(
      gradeLabels.map((grade) => [
        grade,
        Number(formData.get(`grade-${grade}`) ?? 0),
      ]),
    );

    const response = await fetch("/api/manager/setup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // A missing organization id is not enough to mean "a new school": the
        // server scopes an unnamed organization to the school the request is
        // already in, which is what saves an edit of the current school. The
        // intent has to be said out loud, or opening a second school would
        // overwrite the first one.
        createOrganization: isNewSchool && !savedOrganizationId,
        organization: {
          id: isNewSchool
            ? (savedOrganizationId ?? undefined)
            : organization?.id,
          name: formData.get("organizationName"),
          city: formData.get("city"),
          schoolType: formData.get("schoolType"),
          totalStaffCount: Number(formData.get("totalStaffCount")),
        },
        round: {
          // No id is what tells the server this is a new round rather than an
          // edit of the running one — and once this screen has opened one, the
          // id it came back with is what keeps the next save an edit of it. The
          // URL still reads `round=new` after the round exists, so without this
          // a manager who fixed a typo and pressed save again opened a second
          // round, and the school ended up with two drafts of the same quarter.
          id: isNewRound ? (savedRoundId ?? undefined) : round?.id,
          title: formData.get("title"),
          startDate: formData.get("startDate"),
          endDate: formData.get("endDate"),
          privacyThreshold: minimumResponses,
          backgroundContext: {
            notes: formData.get("notes"),
            audience: formData.get("audience"),
            sicknessDaysThisQuarter: Number(
              formData.get("sicknessDaysThisQuarter"),
            ),
            newStaffMembers: Number(formData.get("newStaffMembers")),
            studentCount: Number(formData.get("studentCount")),
            socioEconomicIndex: Number(formData.get("socioEconomicIndex")),
            classesPerGrade,
          },
        },
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = response
        ? ((await response.json().catch(() => null)) as { error?: string } | null)
        : null;
      setErrorMessage(
        payload?.error ?? "לא ניתן היה לשמור את ההגדרה. נסו שוב.",
      );
      setSaving(false);
      return;
    }

    const payload = (await response.json().catch(() => null)) as {
      organization?: { id?: string };
      round?: { id?: string };
      savedAt?: string;
    } | null;

    setSavedRoundId(payload?.round?.id ?? null);
    setSavedOrganizationId(payload?.organization?.id ?? null);
    setSavedAt(parseSavedAt(payload?.savedAt));
    setHasUnsavedChanges(false);
    setSaved(true);
    setSaving(false);

    const createdSchoolId = isNewSchool ? payload?.organization?.id : null;
    if (createdSchoolId) {
      // The school exists now, and nothing on this screen — or on the map, the
      // goals or the builder — is about it until the request says so. Naming it
      // in the URL is what moves the manager into the school they just opened,
      // rather than leaving them editing the one they came from.
      router.push(schoolSetupRoute(createdSchoolId));
      return;
    }

    router.refresh();
  }

  return (
    <>
    <form
      className="form-panel setup-form"
      onSubmit={handleSubmit}
      onInput={() => setHasUnsavedChanges(true)}
      onChange={() => setHasUnsavedChanges(true)}
    >
      <section className="form-section-card">
        <header className="form-section-header">
          <span className="form-section-icon">
            <ClipboardPen size={22} aria-hidden="true" />
          </span>
          <h2>פרטים כלליים</h2>
        </header>
        <div className="form-grid">
          <label>
            שם בית הספר
            <input name="organizationName" defaultValue={organization?.name ?? ""} required />
          </label>
          <label>
            עיר
            <input name="city" defaultValue={organization?.city ?? ""} required />
          </label>
          <label>
            סוג בית הספר
            <input name="schoolType" defaultValue={organization?.schoolType ?? ""} required />
          </label>
          <label>
            תקופת מדידה (שם הסבב)
            <input
              name="title"
              defaultValue={round?.title ?? ""}
              aria-describedby="setup-title-note"
              required
            />
          </label>
          <label>
            תאריך פתיחה
            <input name="startDate" type="date" defaultValue={round?.startDate ?? ""} required />
          </label>
          <label>
            תאריך סיום מתוכנן
            <input
              name="endDate"
              type="date"
              defaultValue={round?.endDate ?? ""}
              aria-describedby="setup-end-date-note"
            />
          </label>
        </div>
        {/* The other end of the same name. It is editable in the builder too,
            which is fine — the threshold below already is — but only once both
            screens say it is the same string. */}
        <p id="setup-title-note" className="quiet-note">
          שם הסבב מופיע בבחירת הסבב, בכותרת שהמשיבים רואים ובמסך בניית השאלון
          (תחת <strong>שם הסבב והשאלון</strong>). אפשר לשנות אותו כאן או שם —
          זהו אותו שם.
        </p>

        <p id="setup-end-date-note" className="quiet-note">
          תאריך היעד נרשם ומוצג במסך המעקב, ואינו סוגר את הסבב: הסגירה נעשית
          ידנית ממסך המעקב, כדי שאיש צוות שממלא את השאלון לא ייעצר באמצע.
        </p>

        <label>
          הערת רקע למנהלת
          <textarea
            name="notes"
            defaultValue={round?.backgroundContext?.notes ?? ""}
            rows={3}
          />
        </label>
      </section>

      <section className="form-section-card">
        <header className="form-section-header">
          <span className="form-section-icon">
            <Users size={22} aria-hidden="true" />
          </span>
          <h2>קהל יעד ונתוני רקע</h2>
        </header>
        <div className="form-grid">
          <label>
            קהל יעד
            <select
              name="audience"
              defaultValue={round?.backgroundContext?.audience ?? DEFAULT_AUDIENCE}
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            מספר אנשי צוות
            <input
              name="totalStaffCount"
              type="number"
              min="1"
              value={totalStaffCount}
              onChange={(event) => setTotalStaffCount(event.target.value)}
              aria-describedby={staffFloorWarning ? staffFloorWarningId : undefined}
              required
            />
            <StaffFloorWarning
              id={staffFloorWarningId}
              totalStaffCount={Number(totalStaffCount)}
              privacyThreshold={minimumResponses}
            />
          </label>
          <label>
            ימי מחלה ברבעון
            <input
              name="sicknessDaysThisQuarter"
              type="number"
              min="0"
              defaultValue={
                round?.backgroundContext?.sicknessDaysThisQuarter ?? 0
              }
            />
          </label>
          <label>
            אנשי צוות חדשים
            <input
              name="newStaffMembers"
              type="number"
              min="0"
              defaultValue={round?.backgroundContext?.newStaffMembers ?? 0}
            />
          </label>
          <label>
            מספר תלמידים בבית הספר
            <input
              name="studentCount"
              type="number"
              min="0"
              defaultValue={round?.backgroundContext?.studentCount ?? 0}
            />
          </label>
          <label>
            מדד טיפוח (דירוג סוציו-אקונומי 1-10)
            <input
              name="socioEconomicIndex"
              type="number"
              min="1"
              max="10"
              defaultValue={round?.backgroundContext?.socioEconomicIndex ?? 1}
            />
          </label>
        </div>
        <div className="form-subsection">
          <h3>מספר כיתות בכל שכבה</h3>
          <div className="grades-grid">
            {gradeLabels.map((grade) => (
              <label key={grade} className="grade-label">
                שכבה {grade}{"'"}
                <input
                  name={`grade-${grade}`}
                  type="number"
                  min="0"
                  defaultValue={
                    round?.backgroundContext?.classesPerGrade?.[grade] ?? 0
                  }
                  className="grade-input"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="form-section-card">
        <header className="form-section-header">
          <span className="form-section-icon">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <h2>הגדרות פרטיות וחיסיון</h2>
        </header>
        <fieldset className="privacy-choice">
          <legend>מצב איסוף התשובות</legend>
          <label className="privacy-radio">
            <input type="radio" name="privacy-mode" value="anonymous" defaultChecked />
            <span>
              <strong>אנונימי לחלוטין</strong>
              <small>לא ניתן לשייך תשובות לאנשי צוות ספציפיים. זו הדרך היחידה במערכת.</small>
            </span>
          </label>
        </fieldset>
        <div className="form-grid">
          <label>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              סף פרטיות (מינימום להצגת תוצאות)
              <PrivacyTooltip minimumResponses={minimumResponses} />
            </span>
            <input
              name="privacyThreshold"
              type="number"
              min={MINIMUM_PRIVACY_THRESHOLD}
              value={minimumResponses}
              onChange={(event) => setMinimumResponses(Number(event.target.value))}
              required
            />
          </label>
        </div>
        <div className="map-privacy-note">
          <ShieldCheck size={20} aria-hidden="true" />
          <p>
            התוצאות ייפתחו רק לאחר {minimumResponses} תשובות לפחות, ותמיד ברמה מצרפית —
            בלי שמות, בלי מיילים ובלי אפשרות לזהות משיב בודד.
          </p>
        </div>
        <PrivacyThresholdNotice
          minimumResponses={minimumResponses}
          emphasis="form"
        />
      </section>

      <aside className="setup-tip">
        <Lightbulb size={20} aria-hidden="true" />
        <p>
          טיפ ניהולי: מומלץ לפתוח סבב חדש בתחילת כל רבעון וליידע את הצוות מראש על מועד הפתיחה —
          כך אפשר לעקוב אחר מגמות לאורך שנת הלימודים.
        </p>
      </aside>

      {/*
        Opening a school or a round is a separate decision from saving this one,
        so it sits in its own row and never in the save bar. Each is a link to
        the screen that still does the job without JavaScript, upgraded to a
        dialog when there is any: the dialog asks for the four or five fields
        that actually differ and says what the save will do, which the shared
        forty-field screen could only do in the wording of one button.
      */}
      {!saved && (canOpenNewRound || canOpenNewSchool) ? (
        <div className="form-actions setup-form-create-actions">
          {!isNewRound && canOpenNewRound ? (
            <a
              className="secondary-button"
              href={newRoundSetupRoute()}
              onClick={(event) =>
                openInDialog(event, () => setNewRoundDialogOpen(true))
              }
            >
              <CalendarPlus size={18} aria-hidden="true" />
              פתיחת סבב חדש
            </a>
          ) : null}
          {/*
            Adding a school is offered here rather than in the switcher: with one
            school there is no switcher to offer it from, and that is exactly when
            a second school is added for the first time.
          */}
          {!isNewSchool && canOpenNewSchool ? (
            <a
              className="secondary-button"
              href={newSchoolSetupRoute()}
              onClick={(event) =>
                openInDialog(event, () => setNewSchoolDialogOpen(true))
              }
            >
              <Building2 size={18} aria-hidden="true" />
              הוספת בית ספר
            </a>
          ) : null}
        </div>
      ) : null}

      {/*
        The save button used to sit at the end of forty fields, below the fold on
        every laptop, and the line saying whether anything was unsaved sat below
        it again. A manager who changed the round's name and looked for a way to
        keep it found neither. Both stay on screen now for as long as the form
        is on screen, and they stay together: the state and the button that
        changes it are one thing to read.
      */}
      <div className="setup-form-save-bar">
        <SaveStatus savedAt={savedAt} hasUnsavedChanges={hasUnsavedChanges} />
        <div className="setup-form-save-bar-actions">
          {saved ? (
            <Link className="secondary-button" href={builderHref}>
              {distributeSurveyAction.label}
              <ChevronLeft size={18} aria-hidden="true" />
            </Link>
          ) : null}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Check size={18} aria-hidden="true" />
            )}
            {saving
              ? "שומר..."
              : isNewSchool
                ? "שמירת בית הספר החדש"
                : isNewRound
                  ? "פתיחת הסבב החדש"
                  : "שמירת סבב אבחון"}
          </button>
        </div>
      </div>

      {saved && !hasUnsavedChanges ? (
        <p className="success-note">
          {/*
            The round now opens with the standard questionnaire, so the sentence
            that sent the manager off to make one cover the eight dimensions is
            no longer the next step. What is left to do is read it and save it,
            and saving is what puts the round live.
          */}
          {isNewSchool
            ? "בית הספר נשמר עם סבב האבחון הראשון שלו, וכל המסכים יוצגו עבורו מעכשיו. הסבב נפתח כטיוטה עם שאלון השלומות המלא — עברו עליו במסך בניית השאלון, ושמירה שם תעלה אותו לאוויר."
            : isNewRound
              ? "הסבב החדש נפתח כטיוטה עם שאלון השלומות המלא. עברו עליו במסך בניית השאלון — שמירה שם תעלה אותו לאוויר במקום הסבב הנוכחי."
              : "סבב האבחון נשמר והלינק האנונימי מוכן להפצה."}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="survey-submit-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </form>

    {/*
      Outside the form on purpose: a dialog holds a form of its own, and a form
      inside a form is not a thing HTML has — the browser drops the inner one
      and its fields end up submitting this screen's round.
    */}
    {organization && !isNewSchool && !isNewRound ? (
      <NewRoundDialog
        isOpen={isNewRoundDialogOpen}
        onClose={() => setNewRoundDialogOpen(false)}
        organization={organization}
        onCreated={(newRoundId) => {
          // The round exists as a draft and does nothing until its
          // questionnaire is saved, so the builder for that round — named by
          // id, because the school's active round is still the old one — is
          // where the work continues.
          if (newRoundId) router.push(surveyBuilderRoute(newRoundId));
          else router.refresh();
        }}
        previousRound={
          round
            ? {
                privacyThreshold: round.privacyThreshold,
                backgroundContext: round.backgroundContext,
              }
            : null
        }
      />
    ) : null}

    {!isNewSchool ? (
      <NewSchoolDialog
        isOpen={isNewSchoolDialogOpen}
        onClose={() => setNewSchoolDialogOpen(false)}
        onCreated={(newSchoolId) => {
          // No screen is about the new school until the request says so, so
          // naming it in the URL is what moves the manager into it rather than
          // leaving them editing the one they came from.
          if (newSchoolId) router.push(schoolSetupRoute(newSchoolId));
          else router.refresh();
        }}
      />
    ) : null}
    </>
  );
}
