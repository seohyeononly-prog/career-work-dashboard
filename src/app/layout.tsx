import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { getDataSource, getSheetUrl } from "@/lib/server/repository";
import "./globals.css";

export const metadata: Metadata = {
  title: "업무 대시보드",
  description: "취업운영·일경험 개인 업무 대시보드",
  icons: { icon: "/app-icon.svg", apple: "/app-icon.svg" },
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell source={getDataSource()} sheetUrl={getSheetUrl()}>{children}</AppShell>
      </body>
    </html>
  );
}
