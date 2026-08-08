import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_Hebrew } from "next/font/google";
import "./globals.css";
import { HeaderGate } from "@/components/layout/header-gate";

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  weight: ["400", "700", "800"],
  variable: "--font-noto-hebrew",
  display: "swap",
  preload: false,
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
      </body>
    </html>
  );
}
