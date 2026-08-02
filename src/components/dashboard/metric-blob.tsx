import type { CSSProperties } from "react";
import { useBlobFit } from "@/lib/hooks/use-blob-fit";
import type { ResponseMetric } from "@/lib/demo-data";

export function MetricBlob({
  metric,
  color,
  emphasis = "secondary",
  onRed = false,
}: {
  metric: ResponseMetric;
  color?: string;
  emphasis?: "primary" | "secondary";
  onRed?: boolean;
}) {
  const fitKey = `${metric.label}-${metric.value}-${metric.highlightText ?? metric.helper}`;
  const { containerRef, contentRef } = useBlobFit(fitKey);
  const distribution =
    metric.highlightText || metric.narrativeOnly
      ? undefined
      : metric.distribution;
  const distributionTotal = distribution
    ? distribution.green + distribution.yellow + distribution.red
    : 0;

  return (
    <article
      ref={containerRef as any}
      className={`dashboard-metric-blob dashboard-metric-blob-${emphasis}${onRed ? " is-on-red" : ""}`}
      style={{ "--dimension-surface": color } as CSSProperties}
    >
      <div ref={contentRef as any} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <span className="dashboard-metric-label">{metric.label}</span>
        {metric.narrativeOnly ? null : <strong>{metric.value}</strong>}
        <p>{metric.highlightText ?? metric.helper}</p>
        {distribution && distributionTotal > 0 ? (
          // The same three counts the sentence above already carries, drawn to
          // scale. Hidden from assistive technology so they are not read twice,
          // and safe to ignore entirely: nothing here is said by colour alone.
          <span
            className="dashboard-metric-distribution"
            aria-hidden="true"
            role="presentation"
          >
            <span
              className="dashboard-metric-distribution-segment is-high"
              style={{ flexGrow: distribution.green }}
            />
            <span
              className="dashboard-metric-distribution-segment is-middle"
              style={{ flexGrow: distribution.yellow }}
            />
            <span
              className="dashboard-metric-distribution-segment is-low"
              style={{ flexGrow: distribution.red }}
            />
          </span>
        ) : null}
      </div>
    </article>
  );
}
