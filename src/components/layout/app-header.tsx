"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Activity, ClipboardList, Home, Map, Send, Target, type LucideIcon } from "lucide-react";
import {
  DASHBOARD_ROUND_PARAM,
  homeRoute,
  isMainNavItemActive,
  mainNavItemsForRound,
  navigationLabels,
  routes,
  type MainNavItem,
  type MainNavItemId,
} from "@/lib/navigation";
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
  return (
    <header className="site-header flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        {/*
         * The round the manager is reading lives in the URL, and reading it
         * needs a Suspense boundary: without one a statically rendered route
         * would have to become dynamic to render the header. The fallback is
         * the same navigation without a round, which is what a manager on the
         * school's current round gets anyway.
         */}
        <Suspense fallback={<HeaderNavigation roundId={undefined} />}>
          <RoundAwareHeaderNavigation />
        </Suspense>
      </div>

      <ManagerUserBar />
    </header>
  );
}

function RoundAwareHeaderNavigation() {
  const roundId = useSearchParams()?.get(DASHBOARD_ROUND_PARAM) ?? undefined;

  return <HeaderNavigation roundId={roundId || undefined} />;
}

function HeaderNavigation({ roundId }: { roundId: string | undefined }) {
  const pathname = usePathname() ?? "";

  return (
    <>
      <Link
        href={homeRoute(roundId)}
        className="brand-mark"
        aria-label={navigationLabels.homeAria}
      >
        <span className="brand-symbol" aria-hidden="true">
          מ
        </span>
        <span>
          <strong>{navigationLabels.productName}</strong>
          <small>{navigationLabels.productSubtitle}</small>
        </span>
      </Link>

      <nav className="top-nav" aria-label="ניווט ראשי">
        {mainNavItemsForRound(roundId).map((item) => (
          <HeaderNavigationItem key={item.id} item={item} pathname={pathname} />
        ))}
      </nav>
    </>
  );
}

function HeaderNavigationItem({
  item,
  pathname,
}: {
  item: MainNavItem;
  pathname: string;
}) {
  const Icon = navIcons[item.id];
  // The round rides in the query string, so the path a nav item points at is
  // still what says whether it is the screen on display.
  const isActive = isMainNavItemActive(pathname, routes[item.id]);

  return (
    <Link
      href={item.href}
      className={isActive ? "active" : ""}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}
