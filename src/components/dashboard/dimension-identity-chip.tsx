import { DimensionIcon } from "@/components/ui/dimension-icon";
import type { DimensionPresentation } from "@/lib/dashboard/dimension-presentation";
import { statusLabels } from "@/lib/dashboard/dimension-presentation";
import type { WellbeingStatus } from "@/lib/shalomut-source";

export function DimensionIdentityChip({
  dimension,
  status,
}: {
  dimension: DimensionPresentation;
  status: WellbeingStatus;
}) {
  return (
    <div className="dashboard-dimension-chip" aria-label={`${dimension.conceptLabel}, ${statusLabels[status]}`}>
      <DimensionIcon dimensionId={dimension.id} size={18} />
      <span>{dimension.conceptLabel}</span>
      <small>{statusLabels[status]}</small>
    </div>
  );
}
