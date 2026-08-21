import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { HeaderGate } from "@/components/layout/header-gate";
import { SessionRenewal } from "@/components/layout/session-renewal";
import { HelpBadgeGate } from "@/components/layout/help-badge-gate";

/**
 * The typeface ships in the repository instead of being fetched while the
 * application is built.
 *
 * `next/font/google` downloads the stylesheet and every `.woff2` during
 * `next build`, which makes the build exactly as reliable as
 * `fonts.gstatic.com`. On 2026-08-12 that was not reliable enough: a runner was
 * handed a stylesheet still pointing at files Google had already replaced, all
 * five returned 404, and Turbopack demoted the failed download to a warning
 * before failing the build with `Module not found: Can't resolve
 * '@vercel/turbopack-next/internal/font/google/font'` — a message naming
 * neither the font nor the network. The same commit built cleanly in the
 * job running beside it, which is how a red build became a coin toss.
 *
 * `fonts/README.md` records where the file came from and how to replace it.
 * It carries every codepoint the five subset files did, so nothing about what
 * renders changes. One file replaces five because those five exist only to
 * split the face by `unicode-range`, and `next/font/local` has no way to say
 * that — the cost is 59 KB fetched once and cached immutably, against 32 KB
 * this product was fetching anyway to show Hebrew and digits together.
 *
 * `weight: "100 900"` is the file's own `wght` axis, so this is wider than the
 * three static weights it replaces rather than narrower. `adjustFontFallback`
 * names the same Arial that `globals.css` falls back to, so the swap that
 * `display: "swap"` allows happens between two faces of similar metrics.
 *
 * It is preloaded because there is now exactly one file and every screen in a
 * Hebrew product uses it. That was not true of the five subsets it replaced:
 * preloading those meant requesting the Cyrillic and Greek stubs on every page,
 * for scripts this typeface has no glyphs for, so `preload: false` was the
 * right answer to a question that no longer exists.
 */
const notoSansHebrew = localFont({
  src: "./fonts/noto-sans-hebrew-variable.woff2",
  weight: "100 900",
  variable: "--font-noto-hebrew",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "מפת השלומות",
  description: "מפת שלומות ארגונית בבתי ספר",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={notoSansHebrew.variable}>
      <body>
        <HeaderGate />
        {/* `tabIndex={-1}` so the skip link can actually land focus here;
            without it the browser moves the scroll position and leaves focus
            behind in the navigation. */}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        {/* After `main` rather than inside it: the badge floats over every
            manager screen, including the dashboard, which renders without the
            header — and it is the last thing a keyboard reaches rather than
            something to tab past on the way to the page. */}
        <HelpBadgeGate />
        {/* Renders nothing. It is here rather than in the header because the
            header does not render on the dashboard, and the dashboard is the
            screen a manager reads longest without pressing anything. */}
        <SessionRenewal />
      </body>
    </html>
  );
}
