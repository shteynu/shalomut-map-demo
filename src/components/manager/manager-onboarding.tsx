import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  ShieldAlert,
} from "lucide-react";
import { PageIntro } from "@/components/ui";
import { routes } from "@/lib/navigation";
import type { ManagerOnboardingState } from "@/lib/services";

type ManagerOnboardingProps = {
  organizationName?: string;
  surface?: "page" | "dashboard";
  state?: ManagerOnboardingState;
};

export function ManagerOnboarding({
  organizationName,
  surface = "page",
  state,
}: ManagerOnboardingProps) {
  const scopeRequired = state === "scope-required";
  const needsOrganization = !organizationName;
  const title = scopeRequired
    ? "נדרש שיוך לבית ספר"
    : needsOrganization
    ? "מתחילים בהגדרת בית הספר"
    : "פותחים סבב אבחון ראשון";
  const description = scopeRequired
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
            {scopeRequired
              ? "יש לשייך את פרטי הגישה הניהוליים לבית ספר לפני הצגת נתונים. פנו למנהל המערכת."
              : needsOrganization
              ? "לא מוצגים נתוני דוגמה ולא נוצרים נתונים אוטומטית. ההגדרה הראשונה נשמרת במאגר הנתונים."
              : "מפת השלומות, המעקב וקישור המשיבים ייפתחו לאחר יצירת הסבב."}
          </p>
        </div>
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
