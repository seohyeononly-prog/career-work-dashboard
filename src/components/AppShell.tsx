"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { DataSource } from "@/lib/types";
import { ToastProvider } from "./Toast";
import { cn } from "./ui";

const NAV = [
  {
    group: "업무관리",
    items: [
      { href: "/", label: "홈", icon: "⌂" },
      { href: "/kanban", label: "칸반보드 · 캘린더", icon: "▦" },
    ],
  },
  {
    group: "자주 보는 링크",
    items: [{ href: "/links", label: "취업운영 · 일경험", icon: "↗" }],
  },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5 px-3 py-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1 px-2 text-xs font-semibold text-slate-500">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                      active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    <span className="w-4 text-center text-xs" aria-hidden>
                      {it.icon}
                    </span>
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const FLEX_URL = "https://flex.team/home";

/** 사이드바 아래: flex 바로가기 + 저장소(연결된 시트 열기) */
function SidebarFooter({ source, sheetUrl }: { source: DataSource; sheetUrl: string | null }) {
  return (
    <div className="mx-3 mb-4 space-y-1.5">
      <a
        href={FLEX_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-md border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        flex 열기
        <span aria-hidden>↗</span>
      </a>
      {source === "sheets" && sheetUrl ? (
        <a
          href={sheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="데이터가 저장되는 Google 시트 열기"
          className="flex items-center justify-between rounded-md bg-green-50 px-2.5 py-2 text-xs text-green-700 hover:bg-green-100"
        >
          ● 저장소: Google Sheets
          <span aria-hidden>↗</span>
        </a>
      ) : (
        <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">● 저장소: 개발용 예시 데이터</p>
      )}
    </div>
  );
}

export function AppShell({
  source,
  sheetUrl,
  children,
}: {
  source: DataSource;
  /** 저장소 시트 주소 (Sheets 연결 시) */
  sheetUrl: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col justify-between border-r border-slate-200 bg-white md:flex">
        <div>
          <p className="px-5 pt-5 text-sm font-bold">업무 대시보드</p>
          <Nav />
        </div>
        <SidebarFooter source={source} sheetUrl={sheetUrl} />
      </aside>

      {/* 모바일 메뉴 */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col justify-between bg-white shadow-xl">
            <div>
              <p className="px-5 pt-5 text-sm font-bold">업무 대시보드</p>
              <Nav onNavigate={() => setOpen(false)} />
            </div>
            <SidebarFooter source={source} sheetUrl={sheetUrl} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded p-1 text-lg leading-none text-slate-600 hover:bg-slate-100"
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          <span className="text-sm font-bold">업무 대시보드</span>
        </header>

        {source === "dev" && (
          <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 md:px-6">
            <strong>개발용 예시 데이터로 표시 중입니다.</strong> Google Sheets가 연결되지 않아 변경 사항은 실제로
            저장되지 않으며, 서버를 다시 시작하면 초기화됩니다. 연결 방법은 README를 참고하세요.
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
