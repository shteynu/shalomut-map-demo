"use client";

import Link from "next/link";
import { Check, ChevronLeft, ClipboardPen, Lightbulb, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";
import { getNavigationAction } from "@/lib/navigation";

type SetupFormProps = {
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
  } | null;
};

const gradeLabels = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"];

export function SetupForm({ organization, round }: SetupFormProps) {
  const [saved, setSaved] = useState(false);
  const [minimumResponses, setMinimumResponses] = useState(round?.privacyThreshold ?? 10);
  const distributeSurveyAction = getNavigationAction("distributeSurvey");

  return (
    <form
      className="form-panel setup-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
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
            תקופת מדידה
            <input name="title" defaultValue={round?.title ?? ""} required />
          </label>
          <label>
            תאריך פתיחה
            <input name="startDate" type="date" defaultValue={round?.startDate ?? ""} required />
          </label>
          <label>
            תאריך סגירה
            <input name="endDate" type="date" defaultValue={round?.endDate ?? ""} />
          </label>
        </div>
        <label>
          הערת רקע למנהלת
          <textarea name="notes" defaultValue="" rows={3} />
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
            <select defaultValue="all-staff">
              <option value="all-staff">כלל צוות בית הספר</option>
              <option value="teachers">צוות הוראה בלבד</option>
              <option value="administration">צוות מינהלה</option>
            </select>
          </label>
          <label>
            מספר אנשי צוות
            <input
              name="totalStaffCount"
              type="number"
              min="1"
              defaultValue={organization?.totalStaffCount || ""}
              required
            />
          </label>
          <label>
            ימי מחלה ברבעון
            <input name="sicknessDaysThisQuarter" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            אנשי צוות חדשים
            <input name="newStaffMembers" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            מספר תלמידים בבית הספר
            <input name="studentCount" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            מדד טיפוח (דירוג סוציו-אקונומי 1-10)
            <input name="socioEconomicIndex" type="number" min="1" max="10" defaultValue="1" />
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
                  defaultValue="0"
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
              min="10"
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
      </section>

      <aside className="setup-tip">
        <Lightbulb size={20} aria-hidden="true" />
        <p>
          טיפ ניהולי: מומלץ לפתוח סבב חדש בתחילת כל רבעון וליידע את הצוות מראש על מועד הפתיחה —
          כך אפשר לעקוב אחר מגמות לאורך שנת הלימודים.
        </p>
      </aside>

      <div className="form-actions">
        <button className="primary-button" type="submit">
          <Check size={18} aria-hidden="true" />
          שמירת סבב אבחון
        </button>
        {saved ? (
          <Link className="secondary-button" href={distributeSurveyAction.href}>
            {distributeSurveyAction.label}
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {saved ? <p className="success-note">סבב האבחון נשמר והלינק האנונימי מוכן להפצה.</p> : null}
    </form>
  );
}
