import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { load } from "@/lib/server/load";
import { getDataSource, getSheetUrl, listLinks } from "@/lib/server/repository";
import "./globals.css";

export const metadata: Metadata = {
  title: "업무 대시보드",
  description: "일경험·취업운영 개인 업무 대시보드",
  icons: { icon: "/app-icon.svg", apple: "/app-icon.svg" },
};

export const viewport: Viewport = { themeColor: "#4f46e5" };

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 링크를 못 읽어도 화면은 떠야 하므로 실패하면 빈 목록으로 둔다
  const links = await load(listLinks);
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell
          source={getDataSource()}
          sheetUrl={getSheetUrl()}
          initialLinks={links.ok ? links.data : []}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
