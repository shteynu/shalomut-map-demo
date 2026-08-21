import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { getNavigationAction, helpRoute } from "@/lib/navigation";
import { helpTopicAnchor } from "@/lib/help/manager-help";
import type { RoundLockReason } from "@/lib/types/canonical-analytics";

type DashboardMapLockedProps = {
  responseCount: number;
  minimumResponses: number;
  /**
   * Why the analysis withheld this round, as the analysis decided it.
   *
   * Passed in for the same reason `isLocked` is: this screen used to work the
   * cause out for itself by comparing the two numbers above, which was right
   * only while the count was the only thing that could lock a round. A round
   * that is still collecting is withheld at seventeen answers out of ten, and
   * "another 0 answers and the map opens" is a sentence a manager can watch
   * stay false.
   */
  lockReason: RoundLockReason | null;
};

export function DashboardMapLocked({
  responseCount,
  minimumResponses,
  lockReason,
}: DashboardMapLockedProps) {
  const remaining = Math.max(minimumResponses - responseCount, 0);
  const distributeSurveyAction = getNavigationAction("distributeSurvey");
  const isCollecting = lockReason === "still-collecting";

  return (
    <section
      className="map-locked-stone"
      aria-label={
        isCollecting
          ? "המפה נעולה עד לסגירת הסבב"
          : "המפה נעולה עד להגעה לסף הפרטיות"
      }
    >
      <LockKeyhole size={42} aria-hidden="true" />
      <h2>המפה עדיין נעולה</h2>
      <span className="map-locked-count">
        <strong>{responseCount}</strong>
        {/*
          While the round is open the threshold is not what the number is
          measured against — it has often been passed already — so the count
          stands on its own rather than beside a target it has met.
        */}
        <span>
          {isCollecting
            ? "תשובות התקבלו עד כה"
            : `מתוך ${minimumResponses} תשובות נדרשות`}
        </span>
      </span>
      {/*
        Three reasons, and the same sentence is wrong about two of them. The
        round total is not the only thing that locks a map: the analysis also
        withholds a round that is still collecting, a round where a single
        question drew fewer answers than the threshold, and one whose
        questionnaire does not cover every dimension.
      */}
      {isCollecting ? (
        <p>
          התוצאות ייפתחו כשתסגרו את הסבב. כל עוד תשובות ממשיכות להגיע, כל רענון
          של המסך היה מציג חישוב על קבוצת משיבים מעט אחרת, וההפרש בין שתי צפיות
          היה חושף את תשובותיו של משיב יחיד. לכן סבב מתפרסם על סמך קבוצה אחת
          בלבד, ובינתיים מוצג מספר המשיבים.
        </p>
      ) : remaining > 0 ? (
        <p>
          הסבב נסגר עם {responseCount} תשובות מתוך {minimumResponses} הנדרשות,
          ולכן התוצאות לא ייפתחו. הסף הזה שומר על האנונימיות של הצוות: תוצאות
          מוצגות רק כשאי אפשר לזהות משיב בודד. אפשר לפתוח סבב חדש ולהזמין את
          הצוות שוב.
        </p>
      ) : (
        <p>
          מספר המשיבים הכללי כבר הושג, אבל חלק מהשאלון עדיין לא אסף מספיק תשובות
          כדי להציג אותו בלי לזהות משיב בודד. הסף הזה חל על כל שאלה בנפרד, ולא רק
          על הסבב כולו. בינתיים מוצג מספר המשיבים הכללי בלבד.
        </p>
      )}
      {/*
        Only while there is still something to collect. A closed round cannot
        receive another answer, so offering to hand out its link would be a
        button that changes nothing.
      */}
      {isCollecting ? (
        <Link className="primary-button" href={distributeSurveyAction.href}>
          {distributeSurveyAction.label}
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      ) : null}
      {/*
        The dashboard renders without the global header, so this screen carries
        its own way to the explanation. A manager meeting a locked map is the
        likeliest person in the product to want it, and the least likely to
        find it by navigating somewhere else first.
      */}
      <Link className="map-locked-help" href={helpRoute(helpTopicAnchor("privacy"))}>
        למה התוצאה נעולה?
      </Link>
    </section>
  );
}
