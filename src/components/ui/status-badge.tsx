import type { WellbeingStatus } from "@/lib/shalomut-source";
import { statusLabels } from "@/lib/shalomut-source";

export const statusLabelShort: Record<WellbeingStatus, string> = {
  green: "ירוק",
  yellow: "צהוב",
  red: "אדום",
};

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
