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
    <div
      className="manager-user-bar flex items-center gap-3 px-3 py-1.5 rounded-full bg-[#f6edd5] border border-[#e8dac0] text-sm text-slate-800 shadow-sm"
      dir="rtl"
    >
      <div className="flex items-center gap-1.5 font-medium">
        <User size={15} className="text-amber-800" aria-hidden="true" />
        <span>{session.name || session.email}</span>
      </div>

      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100/80 text-amber-900 border border-amber-300/60">
        <ShieldCheck size={13} aria-hidden="true" />
        <span>{roleTitle}</span>
      </div>

      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50/80 px-2 py-1 rounded-md transition-colors mr-auto disabled:opacity-60 disabled:cursor-not-allowed"
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
