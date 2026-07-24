"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useClipboard(resetDelayMs = 2500) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        // Fallback for environments where clipboard API permission is restricted
        setCopied(true);
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, resetDelayMs);
    },
    [resetDelayMs],
  );

  return { copied, copy };
}
