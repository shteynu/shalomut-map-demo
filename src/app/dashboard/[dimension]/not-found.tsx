import Link from "next/link";
import { ArrowLeft, Map } from "lucide-react";
import { PageIntro } from "@/components/ui";
import { routes } from "@/lib/navigation";

/**
 * A dimension address the map does not have.
 *
 * The eight dimensions are the product's fixed taxonomy, so this segment is
 * statically generated from `getDimensionStaticParams()` with
 * `dynamicParams = false`: any ninth name is a 404 before the page runs. That
 * makes a stale bookmark or a hand-edited URL the realistic way to arrive here.
 *
 * The dashboard is headerless, so unlike the root screen this one cannot lean
 * on the top navigation for a way out and states its own. It offers the map
 * rather than the home screen because the map is what the reader was asking
 * for, and it takes `manager-onboarding-page` for the same reason that screen
 * does on the dashboard: without a header, a short panel would otherwise sit in
 * an empty viewport.
 *
 * The link drops the `round` parameter, which lands on the school's active
 * round — the same trade the round-not-found screen makes. A not-found
 * boundary is not given the search params it would need to keep it.
 */
export default function DimensionNotFound() {
  return (
    <div className="page stone-page manager-onboarding-page">
      <PageIntro
        eyebrow="מפת השלומות"
        title="הממד לא נמצא"
        description="הקישור מפנה לממד שאינו קיים במפה. ייתכן שהכתובת נשמרה מגרסה קודמת של המערכת."
      />

      <section className="form-panel manager-onboarding-panel">
        <span className="form-section-icon" aria-hidden="true">
          <Map size={28} />
        </span>
        <div>
          <h2>אין ממד בכתובת הזו</h2>
          <p>
            מפת השלומות בנויה משמונה ממדים קבועים. אפשר לחזור למפה ולבחור ממד
            מתוכה.
          </p>
        </div>
        <Link className="primary-button" href={routes.dashboard}>
          חזרה למפת השלומות
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
