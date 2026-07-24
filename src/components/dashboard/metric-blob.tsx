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

  return (
    <article
      ref={containerRef as any}
      className={`dashboard-metric-blob dashboard-metric-blob-${emphasis}${onRed ? " is-on-red" : ""}`}
      style={{ "--dimension-surface": color } as CSSProperties}
    >
      <div ref={contentRef as any} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <span className="dashboard-metric-label">{metric.label}</span>
        <strong>{metric.value}</strong>
        <p>{metric.highlightText ?? metric.helper}</p>
      </div>
    </article>
  );
}
