"use client";

import "./globals.css";

/**
 * The boundary of last resort: the root layout itself failed to render.
 *
 * Because the layout is what threw, this file replaces it — hence its own
 * `<html>` and `<body>`, and hence the stylesheet imported here rather than
 * inherited. For the same reason it imports no component, no icon set and no
 * navigation module: every dependency added here is another way for the screen
 * that reports a failure to fail. The font is the one `globals.css` falls back
 * to when the layout's `next/font` variable is absent.
 *
 * A manager should almost never see this. `app/error.tsx` catches everything
 * below the layout, which is where the product's own failures happen.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="page stone-page">
          <section className="form-panel manager-onboarding-panel">
            <div>
              <h2>המערכת לא נטענה</h2>
              <p>
                אירעה תקלה בטעינת המערכת. אפשר לנסות לטעון מחדש; אם התקלה חוזרת,
                כדאי לנסות שוב בעוד מספר דקות.
              </p>
            </div>
            <button className="primary-button" type="button" onClick={reset}>
              טעינה מחדש
            </button>
          </section>
        </div>
      </body>
    </html>
  );
}
