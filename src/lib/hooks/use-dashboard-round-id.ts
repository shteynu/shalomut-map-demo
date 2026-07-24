"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribeToLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

export function useDashboardRoundId(fallbackRoundId: string) {
  const getServerSnapshot = useCallback(() => fallbackRoundId, [fallbackRoundId]);
  const getClientSnapshot = useCallback(() => {
    const roundId = new URLSearchParams(window.location.search).get("roundId");
    return roundId?.trim() || fallbackRoundId;
  }, [fallbackRoundId]);

  return useSyncExternalStore(
    subscribeToLocation,
    getClientSnapshot,
    getServerSnapshot,
  );
}
