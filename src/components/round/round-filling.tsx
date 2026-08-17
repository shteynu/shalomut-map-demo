import { FastForward, Gauge, Hourglass } from "lucide-react";
import {
  FAST_FILLING_FRACTION,
  FILLING_DETAIL_MINIMUM,
} from "@/lib/analytics/filling-duration";
import type { RoundFillingReport } from "@/lib/services";

const minutesFormatter = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 1,
});

/**
 * How long the round's questionnaires took, and what that does not license.
 *
 * The manager asked to see suspiciously filled questionnaires in order to
 * remove them. This panel is the half of that the product may show, and it is
 * written so that the other half does not read as merely missing: the closing
 * sentence says the system will not remove a response and why, because a
 * manager who is not told why will reasonably ask for the button.
 *
 * Two things the copy is careful about, both of which a shorter version got
 * wrong first. A duration here is the lifetime of a filling session, so it is
 * an upper bound on attention and never a measurement of it — the head says
 * "how long there was", not "how long was spent". And a response with no timing
 * is not a fast one; it says so in the sentence that reports them, next to the
 * count, rather than in a footnote.
 *
 * Nothing here is carried by colour. Each number has an icon and a label, and
 * the fast count is a sentence before it is a figure.
 */
export function RoundFilling({ report }: { report: RoundFillingReport }) {
  return (
    <section className="round-filling" aria-labelledby="round-filling-title">
      <div className="round-filling-head">
        <h2 id="round-filling-title">כמה זמן לקח למלא</h2>
        <p>
          הזמן נמדד מפתיחת השאלון ועד שליחתו — כמה זמן היה למילוי, לא כמה זמן
          הושקע בו. לשונית שנשארה פתוחה תיראה ארוכה, ולכן המספר מדויק בכיוון אחד
          בלבד: מילוי קצר הוא באמת קצר.
        </p>
      </div>

      <RoundFillingBody report={report} />
    </section>
  );
}

/** Exported for tests, which render one state at a time. */
export function RoundFillingBody({ report }: { report: RoundFillingReport }) {
  if (report.status === "no-questionnaire") {
    return (
      <p className="round-filling-empty">
        לסבב הזה לא נשמר שאלון משלו, ולכן אין זמן משוער להשוות אליו. אחרי שמירת
        השאלון בסבב, הנתון יופיע כאן.
      </p>
    );
  }

  if (report.status === "below-privacy-threshold") {
    return (
      <p className="round-filling-empty">
        הנתון יוצג לאחר {report.threshold} תשובות, ובינתיים התקבלו{" "}
        {report.responses}. עד אז דוח על זמני המילוי היה מתאר קבוצה קטנה מדי
        מכדי להישאר אנונימית.
      </p>
    );
  }

  const { estimatedMinutes, responses, unmeasured, durations } = report.summary;
  const fastBoundary = estimatedMinutes * FAST_FILLING_FRACTION;
  const unmeasuredTotal =
    unmeasured.withoutToken + unmeasured.withoutAttempt + unmeasured.unusable;

  if (durations.measured === 0) {
    return (
      <p className="round-filling-empty">
        לאף אחת מ־{responses} התשובות אין מדידת זמן. הן התקבלו לפני שהמדידה הזו
        הופעלה, או שהכניסה לשאלון לא נרשמה. תשובה ללא מדידת זמן אינה תשובה
        מהירה — היא פשוט לא נמדדה.
      </p>
    );
  }

  return (
    <>
      <ol className="round-filling-steps">
        <li className="round-filling-step">
          <span className="round-filling-icon">
            <Hourglass size={22} aria-hidden="true" />
          </span>
          <strong>{minutesFormatter.format(estimatedMinutes)}</strong>
          <span className="round-filling-label">דקות שהשאלון מבקש</span>
          <span className="round-filling-helper">
            מחושב מהשאלות שהסבב הזה שואל
          </span>
        </li>
        <li className="round-filling-step">
          <span className="round-filling-icon">
            <Gauge size={22} aria-hidden="true" />
          </span>
          <strong>
            {durations.medianMinutes === undefined
              ? "—"
              : minutesFormatter.format(durations.medianMinutes)}
          </strong>
          <span className="round-filling-label">דקות במילוי האמצעי</span>
          <span className="round-filling-helper">
            {durations.medianMinutes === undefined
              ? `יוצג כשיימדדו ${FILLING_DETAIL_MINIMUM} מילויים לפחות`
              : `מתוך ${durations.measured} מילויים שנמדדו`}
          </span>
        </li>
        <li className="round-filling-step">
          <span className="round-filling-icon">
            <FastForward size={22} aria-hidden="true" />
          </span>
          {/*
            Written in words rather than as `< 3`. The `<` is bidi-neutral, so
            in an RTL line it reorders to the far side of the digit and the tile
            reads `3 >` — the opposite claim, and one a markup assertion cannot
            see. Caught in a browser; the smaller class is because a phrase does
            not fit the figure size the other two tiles use.
          */}
          <strong
            className={
              durations.farBelowEstimate.known
                ? undefined
                : "round-filling-bounded"
            }
          >
            {durations.farBelowEstimate.known
              ? durations.farBelowEstimate.count
              : `פחות מ־${durations.farBelowEstimate.fewerThan}`}
          </strong>
          <span className="round-filling-label">הוחזרו מהר מדי</span>
          <span className="round-filling-helper">
            פחות מ־{minutesFormatter.format(fastBoundary)} דקות, שליש מהזמן
            המשוער
          </span>
        </li>
      </ol>

      {/*
        Every sentence here names the denominator it was computed over. Without
        it, "no questionnaire came back too fast" reads the same over two
        measured sessions as over two hundred, and a round whose answers mostly
        predate this measurement is exactly where that sentence sounds most
        reassuring and means least.
      */}
      <p className="round-filling-note">
        {durations.farBelowEstimate.known
          ? durations.farBelowEstimate.count === 0
            ? `אף שאלון מבין ${
                durations.measured
              } שנמדדו לא הוחזר בפחות מ־${minutesFormatter.format(
                fastBoundary,
              )} דקות. כולם לקחו לפחות שליש מהזמן שהשאלון מבקש.`
            : `${durations.farBelowEstimate.count} שאלונים מבין ${
                durations.measured
              } שנמדדו הוחזרו בפחות מ־${minutesFormatter.format(
                fastBoundary,
              )} דקות — פחות מהזמן שדרוש כדי לקרוא את השאלות.`
          : `פחות מ־${durations.farBelowEstimate.fewerThan} שאלונים מבין ${
              durations.measured
            } שנמדדו הוחזרו בפחות מ־${minutesFormatter.format(
              fastBoundary,
            )} דקות. המספר המדויק אינו מוצג, כדי שלא יתאר אדם אחד.`}
      </p>

      {unmeasuredTotal > 0 ? (
        <p className="round-filling-note">
          ל־{unmeasuredTotal} מתוך {responses} התשובות אין מדידת זמן — הן
          התקבלו לפני שהמדידה הזו הופעלה, או שהכניסה לשאלון לא נרשמה. תשובה ללא
          מדידת זמן אינה תשובה מהירה, והיא אינה נספרת בשלושת המספרים שמעל.
        </p>
      ) : null}

      <p className="round-filling-note">
        מה אפשר לעשות עם זה: להאריך את הסבב, לנסח מחדש את ההזמנה או לפנות לצוות
        שוב. המערכת אינה מסירה תשובות ואינה מציעה להסיר אותן — לסבב יש בסיס
        חישוב אחד בלבד, ופרסום של שני חישובים שנבדלים במשיב אחד היה חושף את
        תשובותיו.
      </p>
    </>
  );
}
