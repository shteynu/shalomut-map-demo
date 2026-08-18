import type { WellbeingStatus } from "@/lib/shalomut-source";
import { statusColorLabels, statusLabels } from "@/lib/shalomut-source";

/**
 * Kept as this module's name for the colour words, which now live beside the
 * status words they belong with. The badge is no longer their only reader.
 */
export const statusLabelShort: Record<WellbeingStatus, string> =
  statusColorLabels;

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
