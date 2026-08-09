import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  ShieldAlert,
} from "lucide-react";
import { SchoolSwitcher } from "@/components/school";
import { PageIntro } from "@/components/ui";
import { routes } from "@/lib/navigation";
import {
  hasSchoolChoice,
  type SchoolChoices,
} from "@/lib/schools/school-options";
import type { ManagerOnboardingState } from "@/lib/services";

type ManagerOnboardingProps = {
  organizationName?: string;
  surface?: "page" | "dashboard";
  state?: ManagerOnboardingState;
  /**
   * The schools a manager can move to from the two dead ends below, and the
   * round to carry with them. Null on every other state, and on a system with
   * one school there is nothing to offer.
   */
  schoolChoices?: SchoolChoices | null;
};

export function ManagerOnboarding({
  organizationName,
  surface = "page",
  state,
  schoolChoices,
}: ManagerOnboardingProps) {
  const scopeRequired = state === "scope-required";
  const roundNotFound = state === "round-not-found";
  const needsOrganization = !organizationName;
  // Whether this screen can offer a way out at all. The dead ends below are the
  // only states that ask for the list, and one school is not a choice.
  const canChooseSchool = Boolean(
    schoolChoices && hasSchoolChoice(schoolChoices.options),
  );

  // A link naming a round this school does not have. Showing another round's
  // numbers under it would misreport, so the screen says so and offers the
  // active round by name.
  if (roundNotFound) {
    return (
      <div
        className={
          surface === "dashboard"
            ? "page stone-page manager-onboarding-page"
            : "page stone-page"
        }
      >
        <PageIntro
          eyebrow={organizationName ?? "מפת השלומות"}
          title="הסבב המבוקש לא נמצא"
          description="הקישור מפנה לסבב אבחון שאינו קיים בבית הספר הזה. ייתכן שהסבב נמחק או שהקישור הגיע מבית ספר אחר."
        />

        <section className="form-panel manager-onboarding-panel">
          <span className="form-section-icon" aria-hidden="true">
            <ShieldAlert size={28} />
          </span>
          <div>
            <h2>לא הוצגו נתונים</h2>
            <p>
              כדי לא להציג נתונים של סבב אחר תחת הקישור הזה, המערכת אינה בוחרת
              סבב חלופי בעצמה. אפשר לחזור למפה של הסבב הפעיל ולבחור סבב מהרשימה.
            </p>
          </div>
          {/*
            The one screen where a school switcher belongs outside the setup
            screen. A link that names a round this school does not have is
            usually a link from another school, and until now the only way out
            led back to the school the manager was already in. It renders
            nothing when there is only one school, because then there is nothing
            to have come from.
          */}
          {canChooseSchool && schoolChoices ? (
            <div className="manager-onboarding-schools">
              <p>
                אם הקישור הגיע מבית ספר אחר, בחרו אותו כאן והמערכת תבקש ממנו את
                אותו הסבב.
              </p>
              <SchoolSwitcher
                options={schoolChoices.options}
                roundId={schoolChoices.roundId}
                action={null}
              />
            </div>
          ) : null}
          <Link className="primary-button" href={routes.dashboard}>
            חזרה למפת הסבב הפעיל
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
        </section>
      </div>
    );
  }

  // The request named no school the system has — usually a remembered choice
  // whose school was deleted since. With several schools left, choosing one is
  // the whole fix, so the screen offers it rather than reading as a permissions
  // problem the manager has to report to somebody.
  const scopeRequiredWithChoice = scopeRequired && canChooseSchool;

  const title = scopeRequiredWithChoice
    ? "בחירת בית ספר"
    : scopeRequired
    ? "נדרש שיוך לבית ספר"
    : needsOrganization
    ? "מתחילים בהגדרת בית הספר"
    : "פותחים סבב אבחון ראשון";
  const description = scopeRequiredWithChoice
    ? "המסך שביקשתם אינו משויך לבית ספר. ייתכן שבית הספר שנבחר קודם נמחק. בחרו בית ספר מהרשימה וכל המסכים יוצגו עבורו."
    : scopeRequired
    ? "הגישה הניהולית אינה משויכת לבית ספר. המערכת לא תבחר בית ספר אוטומטית כאשר קיימים כמה בתי ספר."
    : needsOrganization
    ? "המערכת עדיין ריקה. הזינו את פרטי בית הספר ופתחו סבב אבחון — רק לאחר השמירה ייווצרו נתונים."
    : `בית הספר ${organizationName} שמור, אבל עדיין אין סבב אבחון. פתחו סבב כדי לקבל קישור אנונימי לצוות.`;

  return (
    <div
      className={
        surface === "dashboard"
          ? "page stone-page manager-onboarding-page"
          : "page stone-page"
      }
    >
      <PageIntro
        eyebrow={
          scopeRequired
            ? "הגנת נתוני בתי ספר"
            : organizationName ?? "מפת השלומות"
        }
        title={title}
        description={description}
      />

      <section className="form-panel manager-onboarding-panel">
        <span className="form-section-icon" aria-hidden="true">
          {scopeRequired ? (
            <ShieldAlert size={28} />
          ) : needsOrganization ? (
            <Building2 size={28} />
          ) : (
            <ClipboardList size={28} />
          )}
        </span>
        <div>
          <h2>
            {scopeRequired
              ? "לא ניתן לבחור בית ספר אוטומטית"
              : needsOrganization
                ? "אין עדיין נתונים במערכת"
                : "אין עדיין סבב פעיל"}
          </h2>
          <p>
            {scopeRequiredWithChoice
              ? "כדי לא להציג נתונים של בית ספר אחר, המערכת אינה בוחרת בית ספר בעצמה כאשר קיימים כמה."
              : scopeRequired
              ? "יש לשייך את פרטי הגישה הניהוליים לבית ספר לפני הצגת נתונים. פנו למנהל המערכת."
              : needsOrganization
              ? "לא מוצגים נתוני דוגמה ולא נוצרים נתונים אוטומטית. ההגדרה הראשונה נשמרת במאגר הנתונים."
              : "מפת השלומות, המעקב וקישור המשיבים ייפתחו לאחר יצירת הסבב."}
          </p>
        </div>
        {/*
          The way out of a request with no school. It is the same control the
          setup screen offers for the same state, put where the manager already
          is: every screen here reads inside a school, so the choice reopens the
          screen the link was for rather than sending them somewhere else first.
        */}
        {scopeRequiredWithChoice && schoolChoices ? (
          <div className="manager-onboarding-schools">
            <SchoolSwitcher
              options={schoolChoices.options}
              roundId={schoolChoices.roundId}
              action={null}
            />
          </div>
        ) : null}
        {!scopeRequired ? (
          <Link className="primary-button" href={routes.setup}>
            {needsOrganization ? "הגדרת בית הספר" : "פתיחת סבב אבחון"}
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
        ) : null}
      </section>
    </div>
  );
}
