import Link from "next/link";
import { BarChart3, ChevronRight, Lightbulb, type LucideIcon } from "lucide-react";
import type { DashboardActionId, DashboardNavigationAction } from "@/lib/navigation";

const dashboardActionIcons: Record<DashboardActionId, LucideIcon> = {
  dimensionMetrics: BarChart3,
  dimensionRecommendations: Lightbulb,
  dashboardMap: ChevronRight,
};

export function DashboardCtaRow({
  actions,
  center = false,
  roundId,
}: {
  actions: DashboardNavigationAction[];
  center?: boolean;
  roundId?: string;
}) {
  return (
    <nav className={`dashboard-cta-row${center ? " dashboard-cta-row-center" : ""}`} aria-label="ניווט מסך">
      {actions.map((action) => {
        const Icon = dashboardActionIcons[action.id];
        const href = roundId
          ? `${action.href}?roundId=${encodeURIComponent(roundId)}`
          : action.href;
        return (
          <Link
            key={`${action.href}-${action.label}`}
            className={`dashboard-pill-button dashboard-pill-button-${action.variant}`}
            href={href}
          >
            {action.label}
            <Icon size={22} aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
