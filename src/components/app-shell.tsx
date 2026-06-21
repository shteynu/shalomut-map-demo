"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, ClipboardList, HelpCircle, Home, Map, Send } from "lucide-react";

const navItems = [
  { href: "/", label: "מרכז ניהול", icon: Home },
  { href: "/setup", label: "הגדרת סבב אבחון", icon: Activity },
  { href: "/round", label: "מעקב סבב אבחון", icon: Send },
  { href: "/survey", label: "בניית שאלון", icon: ClipboardList },
  { href: "/dashboard", label: "מפת השלומות", icon: Map },
];

export function AppHeader() {
  const pathname = usePathname() ?? "";

  return (
    <header className="site-header">
      <Link href="/" className="brand-mark" aria-label="מפת השלומות - דף הבית">
        <span className="brand-symbol" aria-hidden="true">
          מ
        </span>
        <span>
          <strong>מפת השלומות</strong>
          <small>אבחון שלומות ארגונית</small>
        </span>
      </Link>

      <nav className="top-nav" aria-label="ניווט ראשי">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "active" : ""}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageIntro({ eyebrow, title, description, actions }: PageIntroProps) {
  return (
    <section className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="intro-actions">{actions}</div> : null}
    </section>
  );
}

type MetricCardProps = {
  value: string;
  label: string;
  helper: string;
  className?: string;
};

export function MetricCard({ value, label, helper, className = "" }: MetricCardProps) {
  const showTooltip = label === "סף פרטיות" || label === "סף הצגה";

  return (
    <article className={`metric-card ${className}`.trim()}>
      <strong>{value}</strong>
      <span>
        {label}
        {showTooltip && (
          <span className="custom-tooltip-wrapper">
            <HelpCircle size={14} className="custom-tooltip-icon" />
            <span className="custom-tooltip-content">
              <strong>סף פרטיות (סף מינימום להצגת תוצאות)</strong>
              <span style={{ display: "block", marginTop: "0.4rem", marginBottom: "0.8rem", fontSize: "0.88rem", lineHeight: 1.45 }}>
                זהו מספר המשיבים המינימלי הנדרש כדי לפתוח את מפת השלומות והתוצאות לצפייה (בברירת המחדל: 10 אנשי צוות).
              </span>
              <strong style={{ fontSize: "0.88rem", display: "block", marginBottom: "0.35rem" }}>למה זה חשוב?</strong>
              <ul style={{ margin: 0, paddingRight: "1.1rem", fontSize: "0.84rem", lineHeight: 1.5, listStyleType: "disc" }}>
                <li style={{ marginBottom: "0.3rem" }}><strong>הגנה על אנונימיות</strong>: מניעת אפשרות לזהות משיב בודד לפי תשובותיו או הערותיו.</li>
                <li style={{ marginBottom: "0.3rem" }}><strong>שיקוף משוב כנה</strong>: הצוות מרגיש בטוח לתת ביקורת בונה כשהתוצאות מצרפיות בלבד.</li>
                <li style={{ marginBottom: "0.3rem" }}><strong>מהימנות הנתונים</strong>: קבלת תמונת מצב אובייקטיבית ומקצועית המייצגת את כלל בית הספר.</li>
              </ul>
              <span style={{ display: "block", marginTop: "0.8rem", fontSize: "0.8rem", opacity: 0.85, borderTop: "1px dashed rgba(87, 79, 58, 0.2)", paddingTop: "0.5rem", lineHeight: 1.4 }}>
                כל עוד לא התקבלו מספיק תשובות, המפה תישאר נעולה ויוצג רק מספר המשיבים הכללי.
              </span>
            </span>
          </span>
        )}
      </span>
      <small>{helper}</small>
    </article>
  );
}
