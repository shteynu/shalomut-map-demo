"use client";

import { useEffect, useRef } from "react";

export function useBlobFit(dependencyKey: string) {
  const containerRef = useRef<HTMLDivElement | HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const adjust = () => {
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

      const maxSafeW = W - 32;
      const maxSafeH = H - 32;

      const scaleW = maxSafeW / w;
      const scaleH = maxSafeH / h;
      const scaleDiag = 0.83 / diagonalRatio;

      const neededScale = Math.max(0.65, Math.min(1.0, scaleW, scaleH, scaleDiag));
      content.style.fontSize = `${neededScale}em`;
    };

    adjust();

    const resizeObserver = new ResizeObserver(adjust);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [dependencyKey]);

  return { containerRef, contentRef };
}
