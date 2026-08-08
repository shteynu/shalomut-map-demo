import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { PageIntro } from "@/components/ui";
import { routes } from "@/lib/navigation";

/**
 * The screen for an address that matches no route.
 *
 * Without this file the App Router answers with its own default page: English,
 * left-to-right, on a white background and outside the design system — the one
 * screen in the product that would not look like the product. It reuses the
 * onboarding panel rather than introducing a layout of its own, so a wrong URL
 * lands somewhere recognisably Shalomut.
 *
 * The screen offers the home screen and nothing else. Guessing a nearer
 * destination from a URL that was already wrong would be the same mistake the
 * round-not-found screen refuses to make: it looks like navigation and reads
 * like data.
 */
export default function NotFound() {
  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow="מפת השלומות"
        title="הדף לא נמצא"
        description="הכתובת הזו אינה מובילה למסך קיים במערכת. ייתכן שהקישור חלקי, או שהמסך הוחלף מאז שנשמר."
      />

      <section className="form-panel manager-onboarding-panel">
        <span className="form-section-icon" aria-hidden="true">
          <SearchX size={28} />
        </span>
        <div>
          <h2>אין מסך בכתובת הזו</h2>
          <p>
            כדי לא להציג מסך אחר תחת קישור שאינו שלו, המערכת אינה בוחרת יעד חלופי
            בעצמה. אפשר לחזור למסך הבית ולהמשיך משם.
          </p>
        </div>
        <Link className="primary-button" href={routes.home}>
          חזרה למסך הבית
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
