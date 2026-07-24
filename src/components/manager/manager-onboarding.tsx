import Link from "next/link";
import { ArrowLeft, Building2, ClipboardList } from "lucide-react";
import { PageIntro } from "@/components/ui";
import { routes } from "@/lib/navigation";

type ManagerOnboardingProps = {
  organizationName?: string;
  surface?: "page" | "dashboard";
};

export function ManagerOnboarding({
  organizationName,
  surface = "page",
}: ManagerOnboardingProps) {
  const needsOrganization = !organizationName;
  const title = needsOrganization
    ? "מתחילים בהגדרת בית הספר"
    : "פותחים סבב אבחון ראשון";
  const description = needsOrganization
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
        eyebrow={organizationName ?? "מפת השלומות"}
        title={title}
        description={description}
      />

      <section className="form-panel manager-onboarding-panel">
        <span className="form-section-icon" aria-hidden="true">
          {needsOrganization ? <Building2 size={28} /> : <ClipboardList size={28} />}
        </span>
        <div>
          <h2>{needsOrganization ? "אין עדיין נתונים במערכת" : "אין עדיין סבב פעיל"}</h2>
          <p>
            {needsOrganization
              ? "לא מוצגים נתוני דוגמה ולא נוצרים נתונים אוטומטית. ההגדרה הראשונה נשמרת במאגר הנתונים."
              : "מפת השלומות, המעקב וקישור המשיבים ייפתחו לאחר יצירת הסבב."}
          </p>
        </div>
        <Link className="primary-button" href={routes.setup}>
          {needsOrganization ? "הגדרת בית הספר" : "פתיחת סבב אבחון"}
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
