"use client";

import { useSyncExternalStore } from "react";
import { activeRound } from "@/lib/demo-data";
import { appRoutePrefixes, routes } from "@/lib/navigation";

/* The respondent link must point at the environment the admin is actually
   running (localhost in dev, GitHub Pages in prod). basePath is baked in at
   build time, so we derive it from the current pathname instead: everything
   before the first known app route is the base. */
function deriveBasePath(pathname: string) {
  for (const route of appRoutePrefixes) {
    const index = pathname.indexOf(route);
    if (index >= 0) {
      return pathname.slice(0, index);
    }
  }
  return pathname.replace(/\/$/, "");
}

export function useShareUrl() {
  return useSyncExternalStore(subscribeToLocation, getClientShareUrl, getServerShareUrl);
}

function getServerShareUrl() {
  return activeRound.shareUrl;
}

function getClientShareUrl() {
  if (typeof window === "undefined") {
    return getServerShareUrl();
  }

  const basePath = deriveBasePath(window.location.pathname);
  return `${window.location.origin}${basePath}${routes.respondentSurvey}`;
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
