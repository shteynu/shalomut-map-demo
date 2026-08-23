"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import type { ManagerRole } from "@/lib/auth/types";
import { navigationLabels, shouldHideGlobalHeader } from "@/lib/navigation";

export function HeaderGate({ role }: { role: ManagerRole }) {
  const pathname = usePathname();

  if (shouldHideGlobalHeader(pathname)) {
    return null;
  }

  return (
    <>
      {/*
       * The skip link belongs to the header, not to the document: it exists to
       * skip the six-item navigation, so it appears exactly on the screens that
       * have one. On the respondent screens, where the header is hidden, the
       * content is already the first thing a keyboard reaches.
       */}
      <a className="skip-link" href="#main-content">
        {navigationLabels.skipToContent}
      </a>
      <AppHeader role={role} />
    </>
  );
}
