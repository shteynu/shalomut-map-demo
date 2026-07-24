import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { activeRound } from "@/lib/demo-data";
import { getNavigationAction } from "@/lib/navigation";

export function DashboardMapLocked() {
  const remaining = activeRound.minimumResponses - activeRound.responseCount;
  const distributeSurveyAction = getNavigationAction("distributeSurvey");

  return (
    <section className="map-locked-stone" aria-label="המפה נעולה עד להגעה לסף הפרטיות">
      <LockKeyhole size={42} aria-hidden="true" />
      <h2>המפה עדיין נעולה</h2>
      <span className="map-locked-count">
        <strong>{activeRound.responseCount}</strong>
        <span>מתוך {activeRound.minimumResponses} תשובות נדרשות</span>
      </span>
      <p>
        עוד {remaining} תשובות והמפה תיפתח. הסף הזה שומר על האנונימיות של הצוות: התוצאות מוצגות רק
        כשאי אפשר לזהות משיב בודד. בינתיים מוצג מספר המשיבים הכללי בלבד.
      </p>
      <Link className="primary-button" href={distributeSurveyAction.href}>
        {distributeSurveyAction.label}
        <ArrowLeft size={18} aria-hidden="true" />
      </Link>
    </section>
  );
}
