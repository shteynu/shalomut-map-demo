"use client";

import Link from "next/link";
import { Check, ChevronLeft, ClipboardPen, Lightbulb, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { activeRound, organization } from "@/lib/demo-data";
import { PrivacyTooltip } from "@/components/privacy-tooltip";
import { getNavigationAction } from "@/lib/navigation";

export function SetupForm() {
  const [saved, setSaved] = useState(false);
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
            <input defaultValue={organization.name} />
          </label>
          <label>
            תקופת מדידה
            <input defaultValue={activeRound.period} />
          </label>
          <label>
            תאריך פתיחה
            <input defaultValue={activeRound.openedAt} />
          </label>
          <label>
            תאריך סגירה
            <input defaultValue={activeRound.closesAt} />
          </label>
        </div>
        <label>
          הערת רקע למנהלת
          <textarea defaultValue={activeRound.backgroundInputs.notes} rows={3} />
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
            <input type="number" defaultValue={activeRound.backgroundInputs.teachingStaff} />
          </label>
          <label>
            ימי מחלה ברבעון
            <input type="number" defaultValue={activeRound.backgroundInputs.sicknessDaysThisQuarter} />
          </label>
          <label>
            אנשי צוות חדשים
            <input type="number" defaultValue={activeRound.backgroundInputs.newStaffMembers} />
          </label>
          <label>
            מספר תלמידים בבית הספר
            <input type="number" defaultValue={activeRound.backgroundInputs.studentCount} />
          </label>
          <label>
            מדד טיפוח (דירוג סוציו-אקונומי 1-10)
            <input type="number" min="1" max="10" defaultValue={activeRound.backgroundInputs.socioEconomicIndex} />
          </label>
        </div>
        <div className="form-subsection">
          <h3>מספר כיתות בכל שכבה</h3>
          <div className="grades-grid">
            {Object.entries(activeRound.backgroundInputs.classesPerGrade).map(([grade, count]) => (
              <label key={grade} className="grade-label">
                שכבה {grade}{"'"}
                <input type="number" min="0" defaultValue={count} className="grade-input" />
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
              <PrivacyTooltip />
            </span>
            <input type="number" defaultValue={activeRound.minimumResponses} />
          </label>
        </div>
        <div className="map-privacy-note">
          <ShieldCheck size={20} aria-hidden="true" />
          <p>
            התוצאות ייפתחו רק לאחר {activeRound.minimumResponses} תשובות לפחות, ותמיד ברמה מצרפית —
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
