"use client";

import { usePathname } from "next/navigation";
import { ManagerHelpBadge } from "@/components/help/manager-help-badge";
import { shouldShowHelpBadge } from "@/lib/navigation";

/**
 * Which screens the guide badge appears on.
 *
 * A client component for the same reason `HeaderGate` is one: the decision is
 * the current path, and the layout that mounts it is shared by every screen.
 * `shouldShowHelpBadge` owns the rule and says why there.
 */
export function HelpBadgeGate() {
  if (!shouldShowHelpBadge(usePathname())) {
    return null;
  }

  return <ManagerHelpBadge />;
}
