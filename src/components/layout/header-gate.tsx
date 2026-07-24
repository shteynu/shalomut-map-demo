"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { shouldHideGlobalHeader } from "@/lib/navigation";

export function HeaderGate() {
  const pathname = usePathname();

  if (shouldHideGlobalHeader(pathname)) {
    return null;
  }

  return <AppHeader />;
}
