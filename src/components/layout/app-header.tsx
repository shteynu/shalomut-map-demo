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

/**
 * Two tiers, not one row.
 *
 * The header carries three things that do not compete for the same space: who
 * the manager is, which school and product they are in, and the eight screens
 * they can reach. Laid on one row those eight destinations did not fit, so the
 * nav wrapped into three ragged rows and the sticky header grew to 130px of
 * mostly empty cream — on every screen, above every page. The identity row and
 * the destination strip are now separate bands: the first stays one line
 * because it holds two short things, and the second stays one line because it
 * scrolls sideways when a narrow viewport cannot hold all eight.
 */
export function AppHeader({ role }: { role: ManagerRole }) {
  return (
    <header className="site-header">
      <div className="site-header-top">
        {/*
         * The round the manager is reading lives in the URL, and reading it
         * needs a Suspense boundary: without one a statically rendered route
         * would have to become dynamic to render the header. The fallback is
         * the same navigation without a round, which is what a manager on the
         * school's current round gets anyway.
         *
         * Two boundaries rather than one wrapping both tiers, so the identity
         * bar — which fetches its own session on mount — is never inside a
         * fallback that is about to be replaced.
         */}
        <Suspense fallback={<HeaderBrand roundId={undefined} />}>
          <RoundAwareHeaderBrand />
        </Suspense>

        {/*
         * No guide link here. It sat beside the identity until 2026-08-18, and
         * the floating badge — which reaches the dashboard too, where this
         * header does not render at all — made it a second door to one room, in
         * the corner of the screen a manager reads first.
         */}
        <ManagerUserBar />
      </div>

      <Suspense fallback={<HeaderNavigation roundId={undefined} role={role} />}>
        <RoundAwareHeaderNavigation role={role} />
      </Suspense>
    </header>
  );
}

// `navigationRoundId` is what keeps `round=new` out of these links; it says why
// there rather than here, next to the parameter it is about.
function useNavigationRoundId(): string | undefined {
  return navigationRoundId(
    useSearchParams()?.get(DASHBOARD_ROUND_PARAM) ?? undefined,
  );
}

function RoundAwareHeaderBrand() {
  return <HeaderBrand roundId={useNavigationRoundId()} />;
}

function RoundAwareHeaderNavigation({ role }: { role: ManagerRole }) {
  return <HeaderNavigation roundId={useNavigationRoundId()} role={role} />;
}

function HeaderBrand({ roundId }: { roundId: string | undefined }) {
  return (
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
  );
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
    <nav className="top-nav" aria-label="ניווט ראשי">
      {mainNavItemsForRound(roundId, role).map((item) => (
        <HeaderNavigationItem key={item.id} item={item} pathname={pathname} />
      ))}
    </nav>
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
