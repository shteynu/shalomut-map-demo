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
                <strong>«Саф пратиют» (סף פרטיות — порог конфиденциальности)</strong> — это минимальное количество ответивших сотрудников, при достижении которого менеджеру открывается доступ к карте/результатам опроса (по умолчанию в демо-данных это 10 человек).
                <br /><br />
                <strong>Зачем это нужно?</strong>
                <span style={{ display: "block", marginTop: "0.25rem" }}>
                  1. <strong>Защита анонимности</strong>: Если заполнили всего 2-3 человека, легко догадаться по ответам, кто это написал. Порог исключает эту возможность.
                </span>
                <span style={{ display: "block", marginTop: "0.25rem" }}>
                  2. <strong>Честность ответов</strong>: Зная, что результаты скрыты до достижения порога, сотрудники чувствуют себя в безопасности и дают более искреннюю обратную связь.
                </span>
                <span style={{ display: "block", marginTop: "0.25rem" }}>
                  3. <strong>Релевантность данных</strong>: Агрегированные данные от 10+ человек дают более объективную картину.
                </span>
                <br />
                <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>
                  Если порог не пройден, карта («מפת השלומות») останется заблокированной.
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
