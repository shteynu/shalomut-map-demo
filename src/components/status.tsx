import type { WellbeingStatus } from "@/lib/demo-data";
import { statusLabels } from "@/lib/demo-data";

type StatusBadgeProps = {
  status: WellbeingStatus;
  compact?: boolean;
};

export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {compact ? statusLabelShort[status] : statusLabels[status]}
    </span>
  );
}

export const statusLabelShort: Record<WellbeingStatus, string> = {
  green: "ירוק",
  yellow: "צהוב",
  red: "אדום",
};
