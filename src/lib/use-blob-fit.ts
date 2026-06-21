"use client";

import { useEffect, useRef } from "react";

export function useBlobFit(dependencies: any[]) {
  const containerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const adjust = () => {
      // Reset first to read actual unscaled size
      content.style.fontSize = "1em";

      const containerRect = container.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();

      const W = containerRect.width;
      const H = containerRect.height;
      const w = contentRect.width;
      const h = contentRect.height;

      if (W === 0 || H === 0 || w === 0 || h === 0) return;

      const widthRatio = w / W;
      const heightRatio = h / H;
      const diagonalRatio = Math.sqrt(widthRatio * widthRatio + heightRatio * heightRatio);

      // Safe bounds inside the organic colored border radius.
      // Organic shapes shave off corners, so we aim for a centered bounding box.
      const maxSafeW = W * 0.72;
      const maxSafeH = H * 0.72;

      const scaleW = maxSafeW / w;
      const scaleH = maxSafeH / h;
      const scaleDiag = 0.75 / diagonalRatio;

      // Allow scaling down to 0.35em to prevent any overflow.
      const neededScale = Math.max(0.35, Math.min(1.0, scaleW, scaleH, scaleDiag));
      content.style.fontSize = `${neededScale}em`;
    };

    adjust();

    const resizeObserver = new ResizeObserver(adjust);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, dependencies);

  return { containerRef, contentRef };
}
