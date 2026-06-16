import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ClipboardList, Home, Map, Send } from "lucide-react";

const navItems = [
  { href: "/", label: "מרכז ניהול", icon: Home },
  { href: "/setup", label: "הגדרת סבב", icon: Activity },
  { href: "/round", label: "מעקב סבב", icon: Send },
  { href: "/survey", label: "שאלון", icon: ClipboardList },
  { href: "/dashboard", label: "מפת השלומות", icon: Map },
];

export function AppHeader() {
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
          return (
            <Link key={item.href} href={item.href}>
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
};

export function MetricCard({ value, label, helper }: MetricCardProps) {
  return (
    <article className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{helper}</small>
    </article>
  );
}
