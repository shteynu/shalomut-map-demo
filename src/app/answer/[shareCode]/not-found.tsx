import { Link2Off } from "lucide-react";

/**
 * The respondent's dead link.
 *
 * `page.tsx` calls `notFound()` for a share code that no round matches and for
 * a round that is no longer active, and both used to land on the App Router's
 * English default. A member of staff who followed a link from the staffroom
 * would see a developer's error page and reasonably conclude the survey itself
 * was broken.
 *
 * The two cases are answered with one wording on purpose. Telling an unknown
 * code apart from a closed round out loud would turn this screen into a way to
 * test whether a given code exists, and the respondent's next step — ask the
 * school for a current link — is the same either way.
 *
 * There is no route back into the product: this reader is not a manager, and
 * the manager screens are behind a sign-in that would only look like a wall.
 */
export default function ShareCodeNotFound() {
  return (
    <section className="survey-shell stone-page survey-builder-stone-page">
      <div className="survey-complete">
        <Link2Off size={42} aria-hidden="true" />
        <h1>הקישור אינו פעיל</h1>
        <p>
          השאלון שהקישור הזה מפנה אליו אינו פתוח כרגע. ייתכן שסבב האבחון הסתיים,
          או שבית הספר החליף את הקישור.
        </p>
        <p className="quiet-note">
          לא נשמר שום מידע, וגם לא העובדה שנפתח הקישור. אפשר לפנות לבית הספר
          לקבלת קישור עדכני.
        </p>
      </div>
    </section>
  );
}
