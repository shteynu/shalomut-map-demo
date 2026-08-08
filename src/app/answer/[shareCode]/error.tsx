"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

/**
 * A failure while a member of staff is answering the survey.
 *
 * This is the highest-stakes error surface in the product: the reader is not a
 * manager, cannot be asked to check a log, and has no second way in. So the
 * screen says only what is true and useful — nothing was sent, trying again is
 * safe — and offers the retry as the one action.
 *
 * No digest and no message. A respondent has nothing to do with either, and the
 * message in a development build can carry round contents.
 *
 * `reset` re-renders the segment, which re-runs the server component and its
 * lookup. Answers already given live in the draft the flow keeps in the
 * browser, so a successful retry resumes rather than restarts.
 */
export default function ShareCodeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="survey-shell stone-page survey-builder-stone-page">
      <div className="survey-complete">
        <TriangleAlert size={42} aria-hidden="true" />
        <h1>השאלון לא נטען</h1>
        <p>
          אירעה תקלה בטעינת השאלון. שום תשובה לא נשלחה, וניסיון נוסף אינו יוצר
          מענה כפול.
        </p>
        <button className="primary-button" type="button" onClick={reset}>
          <RefreshCw size={18} aria-hidden="true" />
          ניסיון נוסף
        </button>
        <p className="quiet-note">
          אם התקלה חוזרת, אפשר לנסות שוב מאוחר יותר או לפנות לבית הספר.
        </p>
      </div>
    </section>
  );
}
