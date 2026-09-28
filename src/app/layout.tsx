import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getDataSource } from "@/lib/server/repository";
import "./globals.css";

export const metadata: Metadata = {
  title: "업무 대시보드",
  description: "취업운영·일경험 개인 업무 대시보드",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell source={getDataSource()}>{children}</AppShell>
      </body>
    </html>
  );
}
