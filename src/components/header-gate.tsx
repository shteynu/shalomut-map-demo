"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-shell";

export function HeaderGate() {
  const pathname = usePathname();

  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/survey/dror-q1")) {
    return null;
  }

  return <AppHeader />;
}
