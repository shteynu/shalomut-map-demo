import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { HeaderGate } from "@/components/header-gate";

export const metadata: Metadata = {
  title: "מפת השלומות | דמו",
  description: "דמו UI למפת שלומות ארגונית בבתי ספר",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <HeaderGate />
        <main>{children}</main>
      </body>
    </html>
  );
}
