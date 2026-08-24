"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Activity, ClipboardList, Home, Layers, Map, ScrollText, Send, Target, type LucideIcon } from "lucide-react";
import {
  DASHBOARD_ROUND_PARAM,
  homeRoute,
  isMainNavItemActive,
  mainNavItemsForRound,
  navigationLabels,
  navigationRoundId,
  routes,
  type MainNavItem,
  type MainNavItemId,
} from "@/lib/navigation";
import { ManagerUserBar } from "@/components/layout/manager-user-bar";
import type { ManagerRole } from "@/lib/auth/types";

const navIcons: Record<MainNavItemId, LucideIcon> = {
  home: Home,
  setup: Activity,
  round: Send,
  surveyBuilder: ClipboardList,
  dashboard: Map,
  breakdown: Layers,
  goals: Target,
  activity: ScrollText,
};

export function AppHeader({ role }: { role: ManagerRole }) {
  return (
    // `.site-header` already lays this out: flex, centred, space-between, 1rem
    // gap. The utilities that used to be here restated all four and lost to it
    // anyway, since Tailwind's utilities are layered and the stylesheet is not.
    <header className="site-header">
      <div className="flex items-center gap-6">
        {/*
         * The round the manager is reading lives in the URL, and reading it
         * needs a Suspense boundary: without one a statically rendered route
         * would have to become dynamic to render the header. The fallback is
         * the same navigation without a round, which is what a manager on the
         * school's current round gets anyway.
         */}
        <Suspense fallback={<HeaderNavigation roundId={undefined} role={role} />}>
          <RoundAwareHeaderNavigation role={role} />
        </Suspense>
      </div>

      {/*
       * No guide link here. It sat beside the identity until 2026-08-18, and the
       * floating badge — which reaches the dashboard too, where this header does
       * not render at all — made it a second door to one room, in the corner of
       * the screen a manager reads first.
       */}
      <ManagerUserBar />
    </header>
  );
}

function RoundAwareHeaderNavigation({ role }: { role: ManagerRole }) {
  // `navigationRoundId` is what keeps `round=new` out of these links; it says
  // why there rather than here, next to the parameter it is about.
  const roundId = navigationRoundId(
    useSearchParams()?.get(DASHBOARD_ROUND_PARAM) ?? undefined,
  );

  return <HeaderNavigation roundId={roundId} role={role} />;
}

function HeaderNavigation({
  roundId,
  role,
}: {
  roundId: string | undefined;
  role: ManagerRole;
}) {
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
        {mainNavItemsForRound(roundId, role).map((item) => (
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
