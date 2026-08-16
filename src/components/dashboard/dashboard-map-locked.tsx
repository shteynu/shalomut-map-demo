import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { getNavigationAction } from "@/lib/navigation";

type DashboardMapLockedProps = {
  responseCount: number;
  minimumResponses: number;
};

export function DashboardMapLocked({
  responseCount,
  minimumResponses,
}: DashboardMapLockedProps) {
  const remaining = Math.max(minimumResponses - responseCount, 0);
  const distributeSurveyAction = getNavigationAction("distributeSurvey");

  return (
    <section className="map-locked-stone" aria-label="המפה נעולה עד להגעה לסף הפרטיות">
      <LockKeyhole size={42} aria-hidden="true" />
      <h2>המפה עדיין נעולה</h2>
      <span className="map-locked-count">
        <strong>{responseCount}</strong>
        <span>מתוך {minimumResponses} תשובות נדרשות</span>
      </span>
      {/*
        The round total is not the only thing that locks a map. The analysis
        also withholds a round where a single question drew fewer answers than
        the threshold, and one whose questionnaire does not cover every
        dimension. Those rounds reach this screen with the total already met,
        and promising them "another 0 answers and the map opens" would be a
        sentence a manager can watch stay false.
      */}
      {remaining > 0 ? (
        <p>
          עוד {remaining} תשובות והמפה תיפתח. הסף הזה שומר על האנונימיות של הצוות: התוצאות מוצגות רק
          כשאי אפשר לזהות משיב בודד. בינתיים מוצג מספר המשיבים הכללי בלבד.
        </p>
      ) : (
        <p>
          מספר המשיבים הכללי כבר הושג, אבל חלק מהשאלון עדיין לא אסף מספיק תשובות
          כדי להציג אותו בלי לזהות משיב בודד. הסף הזה חל על כל שאלה בנפרד, ולא רק
          על הסבב כולו. בינתיים מוצג מספר המשיבים הכללי בלבד.
        </p>
      )}
      <Link className="primary-button" href={distributeSurveyAction.href}>
        {distributeSurveyAction.label}
        <ArrowLeft size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
