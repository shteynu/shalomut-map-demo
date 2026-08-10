import { DoorOpen, FileCheck2, PenLine } from "lucide-react";
import type { RoundResponseFunnel } from "@/lib/types/backend";

const dateTimeFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Where the link went, in three numbers.
 *
 * Every one of them counts a **filling session**, not a colleague: one teacher
 * opening the link on a phone and again on a laptop is two sessions, and the
 * product cannot tell — it holds no identity that would let it. The Hebrew says
 * `פתיחות` and `כניסות` rather than `מורים` for exactly that reason, and this is
 * the whole of the honesty available here.
 *
 * What it deliberately does not do is name anybody. The stopping point is
 * suppressed until enough sessions have been abandoned to make it a pattern
 * instead of a person — see `ABANDON_DETAIL_MINIMUM`.
 */
export function RoundFunnel({
  funnel,
  expectedResponses,
}: {
  funnel: RoundResponseFunnel;
  expectedResponses: number;
}) {
  const {
    opened,
    consented,
    completed,
    abandoned,
    medianAbandonedAtQuestion,
    completedWithoutAttempt,
    lastOpenedAt,
  } = funnel;

  // Nothing has been recorded for this round at all. Rather than draw three
  // zeroes — which read as "nobody opened it" when the truth is "we did not
  // start counting until now" — the panel says which of the two it is.
  const nothingRecorded = opened === 0;

  return (
    <section className="round-funnel" aria-labelledby="round-funnel-title">
      <div className="round-funnel-head">
        <h2 id="round-funnel-title">מה קרה עם הקישור</h2>
        <p>
          ספירה של כניסות לשאלון, לא של אנשים: מורה שפתח פעם בנייד ופעם במחשב
          נספר פעמיים, והמערכת אינה יכולה להבחין. אין כאן שמות ואין רשימת משיבים.
        </p>
      </div>

      {nothingRecorded ? (
        <p className="round-funnel-empty">
          עדיין לא נרשמה אף כניסה לשאלון בסבב הזה.
          {completed > 0
            ? ` נשמרו ${completed} תשובות שהתקבלו לפני שהמדידה הזו הופעלה, ולכן אין להן כניסה מתועדת.`
            : " ברגע שמישהו יפתח את הקישור, המספרים כאן יתחילו להתמלא."}
        </p>
      ) : (
        <>
          <ol className="round-funnel-steps">
            <li className="round-funnel-step">
              <span className="round-funnel-icon">
                <DoorOpen size={22} aria-hidden="true" />
              </span>
              <strong>{opened}</strong>
              <span className="round-funnel-label">פתחו את השאלון</span>
              <span className="round-funnel-helper">
                מתוך {expectedResponses} אנשי צוות
              </span>
            </li>
            <li className="round-funnel-step">
              <span className="round-funnel-icon">
                <PenLine size={22} aria-hidden="true" />
              </span>
              <strong>{consented}</strong>
              <span className="round-funnel-label">אישרו והתחילו לענות</span>
              <span className="round-funnel-helper">
                {opened - consented} עצרו במסך ההסבר
              </span>
            </li>
            <li className="round-funnel-step">
              <span className="round-funnel-icon">
                <FileCheck2 size={22} aria-hidden="true" />
              </span>
              <strong>{completed}</strong>
              <span className="round-funnel-label">שלחו תשובות</span>
              <span className="round-funnel-helper">
                {abandoned === 0
                  ? "אף כניסה לא נותרה באמצע"
                  : `${abandoned} התחילו ולא סיימו`}
              </span>
            </li>
          </ol>

          <p className="round-funnel-note">
            {medianAbandonedAtQuestion === undefined
              ? abandoned > 0
                ? "מוקדם מדי לומר היכן עוצרים באמצע — הנתון יוצג כשיצטברו מספיק כניסות כאלה, כדי שלא יתאר אדם אחד."
                : "כל מי שהתחיל לענות גם סיים."
              : `מי שעצר באמצע עשה זאת בדרך כלל בשאלה ${
                  medianAbandonedAtQuestion + 1
                }.`}
            {completedWithoutAttempt > 0
              ? ` ${completedWithoutAttempt} תשובות התקבלו לפני שהמדידה הזו הופעלה, ולכן אינן מופיעות בשלבים שמעל.`
              : ""}
          </p>

          {lastOpenedAt ? (
            <p className="round-funnel-note round-funnel-timestamp">
              הכניסה האחרונה: {dateTimeFormatter.format(lastOpenedAt)}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
