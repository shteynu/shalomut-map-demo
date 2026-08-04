"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { writeToClipboard } from "@/lib/utils/clipboard";

export type ClipboardStatus = "idle" | "copied" | "failed";

export function useClipboard(resetDelayMs = 2500) {
  const [status, setStatus] = useState<ClipboardStatus>("idle");
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
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const written = await writeToClipboard(text);
      setStatus(written ? "copied" : "failed");

      // Success fades on its own: the link is already on the clipboard and the
      // note has nothing left to tell anyone. Failure stays until the next
      // attempt, because it asks the manager to do something.
      if (written) {
        timerRef.current = setTimeout(() => setStatus("idle"), resetDelayMs);
      }

      return written;
    },
    [resetDelayMs],
  );

  return { status, copy };
}
