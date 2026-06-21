"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, ClipboardList, Home, Map, Send } from "lucide-react";
import { useBlobFit } from "@/lib/use-blob-fit";

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
  const { containerRef, contentRef } = useBlobFit([value, label, helper]);
  return (
    <article ref={containerRef as any} className={`metric-card ${className}`.trim()}>
      <div ref={contentRef as any} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{helper}</small>
      </div>
    </article>
  );
}
