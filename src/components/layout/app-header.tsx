"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardList, Home, Map, Send, Target, type LucideIcon } from "lucide-react";
import { isMainNavItemActive, mainNavItems, navigationLabels, routes, type MainNavItemId } from "@/lib/navigation";
import { ManagerUserBar } from "@/components/layout/manager-user-bar";

const navIcons: Record<MainNavItemId, LucideIcon> = {
  home: Home,
  setup: Activity,
  round: Send,
  surveyBuilder: ClipboardList,
  dashboard: Map,
  goals: Target,
};

export function AppHeader() {
  const pathname = usePathname() ?? "";

  return (
    <header className="site-header flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
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
      </div>

      <ManagerUserBar />
    </header>
  );
}
