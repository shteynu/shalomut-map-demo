import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isIdentityProviderConfigured } from "@/lib/auth/identity-provider";
import {
  LOGIN_NEXT_PARAM,
  navigationLabels,
  resolveLoginRedirect,
} from "@/lib/navigation";
import { LoginForm } from "./login-form";

/**
 * Why a sign-in ended without a session, in a sentence.
 *
 * None of these names the address or repeats what the provider said about it.
 * "This address is not invited" and "this address does not exist" are the same
 * sentence on purpose: the login screen is not a directory anyone may query.
 */
const signInErrors: Record<string, string> = {
  provider_unconfigured:
    "התחברות עם החשבון הארגוני אינה זמינה בשרת זה כרגע. יש לפנות למנהל המערכת.",
  provider_refused: "ההתחברות בוטלה. אפשר לנסות שוב.",
  handshake_missing: "תוקף ניסיון ההתחברות פג. יש להתחיל מחדש.",
  state_mismatch: "תוקף ניסיון ההתחברות פג. יש להתחיל מחדש.",
  exchange_failed: "לא הצלחנו לאמת את החשבון מול הספק. יש לנסות שוב.",
  invalid_token: "לא הצלחנו לאמת את החשבון מול הספק. יש לנסות שוב.",
  unverified_email: "כתובת הדוא\"ל של החשבון אינה מאומתת אצל הספק.",
  not_invited: "לחשבון זה אין גישה למערכת. הגישה ניתנת בהזמנה בלבד.",
  no_active_membership: "לחשבון זה אין הרשאות פעילות בבית ספר כלשהו.",
  rate_limited: "יותר מדי ניסיונות התחברות. יש להמתין מעט ולנסות שוב.",
};

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const resolved = await searchParams;
  const nextPath = resolveLoginRedirect(readParam(resolved.next));
  const error = readParam(resolved.error);
  const message = error ? signInErrors[error] : null;

  // One door at a time. A runtime with an identity provider signs in through
  // it and only through it; a runtime without one keeps the interim password
  // form until its provider is configured. Offering both would mean the
  // password stayed a way in after the provider replaced it.
  const usesProvider = isIdentityProviderConfigured();

  const startUrl = `/api/auth/oidc/start?${new URLSearchParams({
    [LOGIN_NEXT_PARAM]: nextPath,
  })}`;

  return (
    <div className="page stone-page login-page">
      <section className="login-shell">
        <Link className="brand-mark" href="/">
          <span className="brand-symbol" aria-hidden="true">
            מ
          </span>
          <span>
            <strong>{navigationLabels.productName}</strong>
            <small>{navigationLabels.productSubtitle}</small>
          </span>
        </Link>

        <h1>התחברות מנהלים</h1>
        <p className="login-intro">
          {usesProvider
            ? "ההתחברות מתבצעת עם החשבון הארגוני של בית הספר"
            : "הזן את פרטי הגישה של בית הספר לכניסה למערכת"}
        </p>

        {message ? (
          <div className="form-panel login-panel">
            <p className="survey-submit-error" role="alert">
              {message}
            </p>
          </div>
        ) : null}

        {usesProvider ? (
          <div className="form-panel login-panel">
            <a className="primary-button" href={startUrl}>
              התחברות עם החשבון הארגוני
              <ArrowLeft size={18} aria-hidden="true" />
            </a>
            <p className="quiet-note">
              הגישה למערכת ניתנת בהזמנה בלבד. אם החשבון שלכם אינו מוכר, יש לפנות
              למנהל המערכת.
            </p>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="form-panel login-panel">
                <p className="quiet-note">טוען טופס התחברות...</p>
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        )}
      </section>
    </div>
  );
}
