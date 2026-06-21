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
              <strong>«Саф пратиют» (סף פרטיות — порог конфиденциальности)</strong> — это минимальное количество ответивших сотрудников, при достижении которого менеджеру открывается доступ к карте/результатам опроса (по умолчанию в демо-данных это 10 человек).
              <br /><br />
              <strong>Зачем это нужно?</strong>
              <span style={{ display: "block", marginTop: "0.25rem" }}>
                1. <strong>Защита анонимности</strong>: Если заполнили всего 2-3 человека, легко догадаться по ответам, кто это написал. Порог исключает эту возможность.
              </span>
              <span style={{ display: "block", marginTop: "0.25rem" }}>
                2. <strong>Честность ответов</strong>: Зная, что результаты скрыты до достижения порога, сотрудники чувствуют себя в безопасности и дают более искреннюю обратную связь.
              </span>
              <span style={{ display: "block", marginTop: "0.25rem" }}>
                3. <strong>Релевантность данных</strong>: Агрегированные данные от 10+ человек дают более объективную картину.
              </span>
              <br />
              <span style={{ fontSize: "0.78rem", opacity: 0.9 }}>
                Если порог не пройден, карта («מפת השלומות») останется заблокированной.
              </span>
            </span>
          </span>
        )}
      </span>
      <small>{helper}</small>
    </article>
  );
}
