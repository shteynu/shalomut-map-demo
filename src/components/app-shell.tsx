"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, ClipboardList, Home, Map, Send, type LucideIcon } from "lucide-react";
import { PrivacyTooltip } from "@/components/privacy-tooltip";
import { isMainNavItemActive, mainNavItems, navigationLabels, routes, type MainNavItemId } from "@/lib/navigation";

const navIcons: Record<MainNavItemId, LucideIcon> = {
  home: Home,
  setup: Activity,
  round: Send,
  surveyBuilder: ClipboardList,
  dashboard: Map,
};

export function AppHeader() {
  const pathname = usePathname() ?? "";

  return (
    <header className="site-header">
      <Link href={routes.home} className="brand-mark" aria-label={navigationLabels.homeAria}>
        <span className="brand-symbol" aria-hidden="true">
          מ
        </span>
        <span>
          <strong>{navigationLabels.productName}</strong>
          <small>{navigationLabels.productSubtitle}</small>
        </span>
      </Link>

      <nav className="top-nav" aria-label="ניווט ראשי">
        {mainNavItems.map((item) => {
          const Icon = navIcons[item.id];
          const isActive = isMainNavItemActive(pathname, item.href);
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
        {showTooltip && <PrivacyTooltip />}
      </span>
      <small>{helper}</small>
    </article>
  );
}
