import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";

type MetricCardProps = {
  value: string;
  label: string;
  helper: string;
  className?: string;
  /**
   * The round's own threshold. Without it the privacy tooltip explained the
   * product default while the card next to it showed a different number.
   */
  minimumResponses?: number;
};

export function MetricCard({
  value,
  label,
  helper,
  className = "",
  minimumResponses,
}: MetricCardProps) {
  const showTooltip = label === "סף פרטיות" || label === "סף הצגה";

  return (
    <article className={`metric-card ${className}`.trim()}>
      <strong>{value}</strong>
      <span>
        {label}
        {showTooltip && <PrivacyTooltip minimumResponses={minimumResponses} />}
      </span>
      <small>{helper}</small>
    </article>
  );
}
