"use client";

import Link from "next/link";
import { Check, ChevronLeft, HelpCircle } from "lucide-react";
import { useState } from "react";
import { activeRound, organization } from "@/lib/demo-data";

export function SetupForm() {
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="form-panel"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
    >
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
        <label>
          מספר אנשי צוות
          <input type="number" defaultValue={activeRound.backgroundInputs.teachingStaff} />
        </label>
        <label>
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            סף מינימום להצגת תוצאות
            <span className="custom-tooltip-wrapper">
              <HelpCircle size={14} className="custom-tooltip-icon" />
              <span className="custom-tooltip-content">
                <strong>סף פרטיות (סף מינימום להצגת תוצאות)</strong>
                <span style={{ display: "block", marginTop: "0.4rem", marginBottom: "0.8rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
                  זהו מספר המשיבים המינימלי הנדרש כדי לפתוח את מפת השלומות והתוצאות לצפייה (בברירת המחדל: 10 אנשי צוות).
                </span>
                <strong style={{ fontSize: "0.88rem", display: "block", marginBottom: "0.35rem" }}>למה זה חשוב?</strong>
                <ul style={{ margin: 0, paddingRight: "1.1rem", fontSize: "0.84rem", lineHeight: 1.5, listStyleType: "disc" }}>
                  <li style={{ marginBottom: "0.3rem" }}><strong>הגנה על אנונימיות</strong>: מניעת אפשרות לזהות משיב בודד לפי תשובותיו או הערותיו.</li>
                  <li style={{ marginBottom: "0.3rem" }}><strong>שיקוף משוב כנה</strong>: הצוות מרגיש בטוח לתת ביקורת בונה כשהתוצאות מצרפיות בלבד.</li>
                  <li style={{ marginBottom: "0.3rem" }}><strong>מהימנות הנתונים</strong>: קבלת תמונת מצב אובייקטיבית ומקצועית המייצגת את כלל בית הספר.</li>
                </ul>
                <span style={{ display: "block", marginTop: "0.8rem", fontSize: "0.8rem", opacity: 0.85, borderTop: "1px dashed rgba(87, 79, 58, 0.2)", paddingTop: "0.5rem", lineHeight: 1.4 }}>
                  כל עוד לא התקבלו מספיק תשובות, המפה תישאר נעולה ויוצג רק מספר המשיבים הכללי.
                </span>
              </span>
            </span>
          </span>
          <input type="number" defaultValue={activeRound.minimumResponses} />
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

      <div className="form-section">
        <h3>מספר כיתות בכל שכבה</h3>
        <div className="grades-grid">
          {Object.entries(activeRound.backgroundInputs.classesPerGrade).map(([grade, count]) => (
            <label key={grade} className="grade-label">
              שכבה {grade}'
              <input type="number" min="0" defaultValue={count} className="grade-input" />
            </label>
          ))}
        </div>
      </div>

      <label>
        הערת רקע למנהלת
        <textarea defaultValue={activeRound.backgroundInputs.notes} rows={4} />
      </label>

      <div className="form-actions">
        <button className="primary-button" type="submit">
          <Check size={18} aria-hidden="true" />
          שמירת סבב אבחון
        </button>
        {saved ? (
          <Link className="secondary-button" href="/round">
            מעבר להפצת שאלון
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {saved ? <p className="success-note">סבב האבחון נשמר והלינק האנונימי מוכן להפצה.</p> : null}
    </form>
  );
}
