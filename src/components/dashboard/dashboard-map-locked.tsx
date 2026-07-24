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
