"use client";

import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
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
          סף מינימום להצגת תוצאות
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
