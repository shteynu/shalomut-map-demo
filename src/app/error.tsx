"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, TriangleAlert } from "lucide-react";
import { PageIntro } from "@/components/ui";
import { routes } from "@/lib/navigation";

/**
 * The screen a manager gets when a route segment throws.
 *
 * The App Router's own fallback is English, left-to-right and unstyled, so a
 * failure that lasted one request used to look like a different product. This
 * boundary keeps the failure inside the design system and, more importantly,
 * keeps it recoverable: `reset` re-renders the segment, which is enough for the
 * failures that are actually transient — a database that was briefly
 * unreachable, a fetch that timed out.
 *
 * What it deliberately does not do is print `error.message`. In production Next
 * already redacts it to a generic string, but in local and deployed development
 * builds it carries whatever the throw site put there: query text, connection
 * strings, row contents. The digest below identifies the same error in the
 * server log without putting any of that on a school's screen.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console only. Nothing here reaches a third party.
    console.error(error);
  }, [error]);

  return (
    <div className="page stone-page">
      <PageIntro
        eyebrow="מפת השלומות"
        title="משהו השתבש"
        description="המסך לא נטען עד הסוף. הנתונים ששמורים במערכת לא נפגעו מהתקלה הזו."
      />

      <section className="form-panel manager-onboarding-panel">
        <span className="form-section-icon" aria-hidden="true">
          <TriangleAlert size={28} />
        </span>
        <div>
          <h2>אפשר לנסות שוב</h2>
          <p>
            לרוב מדובר בתקלה חולפת בטעינת הנתונים. טעינה מחדש של המסך פותרת אותה
            ברוב המקרים. אם התקלה חוזרת, אפשר למסור את מזהה התקלה לתמיכה.
          </p>
        </div>
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={reset}>
            <RefreshCw size={18} aria-hidden="true" />
            טעינה מחדש של המסך
          </button>
          <Link className="secondary-button" href={routes.home}>
            חזרה למסך הבית
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
        </div>
        {error.digest ? (
          <p className="quiet-note">
            {/* A Latin identifier inside a Hebrew sentence: without its own
                direction the RTL context reorders the characters and the
                manager reads out a digest the log does not contain. */}
            מזהה תקלה: <span dir="ltr">{error.digest}</span>
          </p>
        ) : null}
      </section>
    </div>
  );
}
