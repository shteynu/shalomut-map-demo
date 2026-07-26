"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Lock, LogIn, Mail, Shield } from "lucide-react";
import { navigationLabels } from "@/lib/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get("next") || "/";

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

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("אירעה שגיאה ברשת בעת ניסיון ההתחברות. אנא נסה שנית.");
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#fffdf6] border border-[#eadaaf] shadow-xl rounded-2xl p-6 md:p-8 space-y-6">
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm"
        >
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-slate-700"
          >
            כתובת דוא&quot;ל
          </label>
          <div className="relative">
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@shalomut.edu.il"
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#d6c49c] bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/50 focus:border-amber-600 text-sm transition-all"
              dir="ltr"
            />
            <Mail
              size={17}
              className="absolute right-3 top-3 text-slate-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold text-slate-700"
          >
            סיסמה
          </label>
          <div className="relative">
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#d6c49c] bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600/50 focus:border-amber-600 text-sm transition-all"
              dir="ltr"
            />
            <Lock
              size={17}
              className="absolute right-3 top-3 text-slate-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold text-sm shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-600 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span>מתחבר...</span>
          ) : (
            <>
              <LogIn size={18} />
              <span>התחברות למערכת</span>
            </>
          )}
        </button>
      </form>

      {/* Dev Seed Credentials Hint */}
      <div className="pt-4 border-t border-[#f0e4c6] text-xs text-slate-500 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-amber-900">
          <Shield size={14} className="text-amber-700" />
          <span>פרטי התחברות ברירת מחדל לפיתוח:</span>
        </div>
        <p className="font-mono text-slate-600 dir-ltr text-right">
          Admin: admin@shalomut.edu.il / admin123
        </p>
        <p className="font-mono text-slate-600 dir-ltr text-right">
          Manager: manager@shalomut.edu.il / manager123
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[#fbf4dd] text-slate-900 selection:bg-amber-200"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#f5e9c9] border border-[#e2d0a0] text-slate-800 shadow-sm hover:bg-[#efe0b8] transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-amber-700 text-white font-bold text-lg flex items-center justify-center shadow-inner">
              מ
            </span>
            <div className="text-right">
              <span className="block font-bold text-lg leading-tight text-slate-900">
                {navigationLabels.productName}
              </span>
              <span className="block text-xs text-slate-600">
                {navigationLabels.productSubtitle}
              </span>
            </div>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 pt-2">
            התחברות מנהלים
          </h1>
          <p className="text-sm text-slate-600">
            הזן את פרטי הגישה של בית הספר לכניסה למערכת
          </p>
        </div>

        {/* Login Card inside Suspense */}
        <Suspense
          fallback={
            <div className="bg-[#fffdf6] border border-[#eadaaf] shadow-xl rounded-2xl p-8 text-center text-slate-500 text-sm">
              טוען טופס התחברות...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
