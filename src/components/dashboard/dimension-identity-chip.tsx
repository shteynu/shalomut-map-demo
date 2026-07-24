import { DimensionIcon } from "@/components/ui/dimension-icon";
import type { WellbeingDimension } from "@/lib/demo-data";
import { statusLabels } from "@/lib/demo-data";

export function DimensionIdentityChip({ dimension }: { dimension: WellbeingDimension }) {
  return (
    <div className="dashboard-dimension-chip" aria-label={`${dimension.conceptLabel}, ${statusLabels[dimension.status]}`}>
      <DimensionIcon dimensionId={dimension.id} size={18} />
      <span>{dimension.conceptLabel}</span>
      <small>{statusLabels[dimension.status]}</small>
    </div>
  );
}
