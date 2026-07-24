import { PrivacyTooltip } from "@/components/ui/privacy-tooltip";

type MetricCardProps = {
  value: string;
  label: string;
  helper: string;
  className?: string;
};

export function MetricCard({ value, label, helper, className = "" }: MetricCardProps) {
  const showTooltip = label === "סף פרטיות" || label === "סף הצגה";

  return (
    <article className={`metric-card ${className}`.trim()}>
      <strong>{value}</strong>
      <span>
        {label}
        {showTooltip && <PrivacyTooltip />}
      </span>
      <small>{helper}</small>
    </article>
  );
}
