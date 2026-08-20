"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  LOGIN_NEXT_PARAM,
  resolveLoginRedirect,
} from "@/lib/navigation";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = resolveLoginRedirect(searchParams?.get(LOGIN_NEXT_PARAM));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("יש להזין כתובת דוא\"ל וסיסמה");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || "שם המשתמש או הסיסמה אינם נכונים");
        setLoading(false);
        return;
      }

      // A full document load, not `router.push` — and the difference is the
      // whole bug this replaced. The brand link above prefetches `/` while
      // the manager is still signed out, so the client router caches what the
      // middleware answers then: a redirect back to this very screen. After
      // the cookie is set, `router.push("/")` is served from that cache, does
      // not reach the server, and lands where it already is. Nothing tells the
      // form, so it spins on "מתחבר..." forever. Reloading `/login` was the
      // manager's own workaround: with the cookie present the prefetch then
      // returns the real home screen and the push works, which is why the
      // second attempt always felt instant.
      //
      // A hard navigation cannot consult that cache. It also re-renders the
      // root layout against the new session, which is what the `router.refresh()`
      // here was reaching for, and it drops this component before the spinner
      // needs clearing.
      window.location.assign(nextPath);
    } catch {
      setError("אירעה שגיאה ברשת בעת ניסיון ההתחברות. אנא נסה שנית.");
      setLoading(false);
    }
  };

  return (
    <div className="form-panel login-panel">
      {/* `role="alert"` alone. It already implies an assertive live region, and
          the `aria-live="polite"` that used to sit beside it contradicted the
          role rather than softening it. */}
      {error ? (
        <p className="survey-submit-error" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit}>
        {/* The label wraps its input, which is how every other form in the
            product is written — the global `label` rule is a grid, so the text
            sits above the field with no layout of its own. The explicit `id`
            and `htmlFor` stay: they cost nothing and survive a future refactor
            that separates the two. */}
        <label htmlFor="login-email">
          כתובת דוא&quot;ל
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@shalomut.edu.il"
            dir="ltr"
          />
        </label>

        <label htmlFor="login-password">
          סיסמה
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              מתחבר...
            </>
          ) : (
            <>
              התחברות למערכת
              {/* Forward is leftward in Hebrew, and every other primary button
                  in the product says so with this arrow. The `LogIn` icon that
                  used to sit here points right — into a door drawn for a
                  left-to-right reader. */}
              <ArrowLeft size={18} aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
