"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ShieldCheck, User } from "lucide-react";

export interface ManagerSessionData {
  managerId: string;
  email: string;
  name?: string;
  role: "admin" | "manager";
  activeOrganizationId: string;
}

export function ManagerUserBar() {
  const router = useRouter();
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
      router.push("/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  };

  if (loading || !session) {
    return null;
  }

  const roleTitle = session.role === "admin" ? "מנהל מערכת" : "מנהל";

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

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="manager-user-bar-logout"
        aria-label="התנתקות מהמערכת"
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
