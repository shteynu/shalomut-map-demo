"use client";

import { useSyncExternalStore } from "react";
import { respondentSurveyRoute } from "@/lib/navigation";

export function useShareUrl(shareCode: string) {
  const relativePath = respondentSurveyRoute(shareCode);

  return useSyncExternalStore(
    subscribeToLocation,
    () => `${window.location.origin}${relativePath}`,
    () => relativePath,
  );
}

function subscribeToLocation(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}
