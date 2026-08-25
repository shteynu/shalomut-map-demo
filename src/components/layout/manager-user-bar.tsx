"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, ShieldCheck, User } from "lucide-react";
import { routes } from "@/lib/navigation";

export interface ManagerSessionData {
  managerId: string;
  email: string;
  name?: string;
  role: "admin" | "manager";
  activeOrganizationId: string | null;
  isPlatformAdministrator?: boolean;
}

export function ManagerUserBar() {
  const [session, setSession] = useState<ManagerSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.session) {
            setSession(data.session);
          }
        }
      } catch {
        // Silent catch for network issues
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setSession(null);
      // A hard navigation for the same reason signing in needs one, mirrored:
      // the client router is holding every manager screen this session
      // rendered, and `router.push` would leave that cache intact for the Back
      // button to serve after the cookie is gone. A document load discards it.
      window.location.assign(routes.login);
    } catch {
      setIsLoggingOut(false);
    }
  };

  if (loading || !session) {
    return null;
  }

  // A platform administrator is a different thing from the `admin` role inside
  // a school, and the bar has said "מנהל מערכת" for the second one since before
  // the first existed. The wider one wins where somebody has both.
  const roleTitle = session.isPlatformAdministrator
    ? "מנהל פלטפורמה"
    : session.role === "admin"
      ? "מנהל מערכת"
      : "מנהל";

  return (
    <div className="manager-user-bar" dir="rtl">
      <span className="manager-user-bar-identity">
        <User size={15} aria-hidden="true" />
        <span>{session.name || session.email}</span>
      </span>

      <span className="manager-user-bar-role">
        <ShieldCheck size={13} aria-hidden="true" />
        <span>{roleTitle}</span>
      </span>

      {/* The only way into the administrator area, and it is rendered for
          nobody else. The middleware refuses the route regardless — this is
          navigation, not a permission. */}
      {session.isPlatformAdministrator ? (
        <Link href={routes.admin} className="manager-user-bar-admin-link">
          ניהול פלטפורמה
        </Link>
      ) : null}

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="manager-user-bar-logout"
        aria-label="התנתקות מהמערכת"
        // The word beside the icon is hidden on narrow screens, where the
        // pointer that would read this is a finger — but a desktop reader who
        // shrinks the window gets the name back on hover.
        title="התנתקות מהמערכת"
      >
        {isLoggingOut ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            <span>מתנתק...</span>
          </>
        ) : (
          <>
            <LogOut size={14} aria-hidden="true" />
            <span>התנתקות</span>
          </>
        )}
      </button>
    </div>
  );
}
