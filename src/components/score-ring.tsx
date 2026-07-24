type ScoreRingProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
};

/* Progress ring per design system: navy track, teal fill.
   In RTL the ring sweeps counter-clockwise from 12 o'clock. */
export function ScoreRing({ value, size = 96, strokeWidth = 10 }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const filled = (clamped / 100) * circumference;

  return (
    <svg
      className="score-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`ציון כולל ${clamped} מתוך 100`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(45, 48, 126, 0.18)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--teal)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform={`rotate(90 ${size / 2} ${size / 2}) scale(-1 1) translate(-${size} 0)`}
      />
    </svg>
  );
}
