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

/**
 * How wide the value is allowed to shout.
 *
 * These cards are drawn as stones on the round screen — organic radii, no
 * straight sides — so the usable width is roughly three quarters of the box
 * and narrows further away from the middle. A response count ("12") has room
 * to be enormous; a date ("25.08.2026") and a stand-in phrase ("לא נקבע") do
 * not, and at the same size they ran out over the curve and onto the cream.
 * The size follows the value's own length rather than the card's, because the
 * card's width is the one thing that does not change between them.
 */
function valueWidthClass(value: string): string {
  const characters = [...value.trim()].length;

  if (characters >= 8) {
    return " metric-card-value-long";
  }

  if (characters >= 5) {
    return " metric-card-value-medium";
  }

  return "";
}

export function MetricCard({
  value,
  label,
  helper,
  className = "",
  minimumResponses,
}: MetricCardProps) {
  const showTooltip = label === "סף פרטיות" || label === "סף הצגה";

  return (
    <article
      className={`metric-card ${className}${valueWidthClass(value)}`.trim()}
    >
      <strong>{value}</strong>
      <span>
        {label}
        {showTooltip && <PrivacyTooltip minimumResponses={minimumResponses} />}
      </span>
      <small>{helper}</small>
    </article>
  );
}
