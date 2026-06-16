"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-shell";

export function HeaderGate() {
  const pathname = usePathname();

  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  return <AppHeader />;
}
