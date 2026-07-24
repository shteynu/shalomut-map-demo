import type { CSSProperties } from "react";
import { useBlobFit } from "@/lib/hooks/use-blob-fit";

export function RecommendationBlob({
  recommendation,
  className,
  color,
  priority,
  featured = false,
  onRed = false,
}: {
  recommendation: { title: string; body: string };
  className: string;
  color?: string;
  priority: number;
  featured?: boolean;
  onRed?: boolean;
}) {
  const { containerRef, contentRef } = useBlobFit(`${recommendation.title}-${recommendation.body}`);

  return (
    <article
      ref={containerRef as any}
      className={`${className}${featured ? " is-featured" : ""}${onRed ? " is-on-red" : ""}`}
      style={{ "--dimension-surface": color } as CSSProperties}
    >
      <div ref={contentRef as any} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <span className="dashboard-recommendation-priority">{priority === 1 ? "יעד ראשון" : `יעד ${priority}`}</span>
        <h2>{recommendation.title}</h2>
        <p>{recommendation.body}</p>
      </div>
    </article>
  );
}
