"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { upsert } from "@/lib/client-api";
import type { DataSource, Shortcut } from "@/lib/types";
import { ShortcutFormModal } from "./forms";
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
    items: [{ href: "/links", label: "일경험 · 취업운영", icon: "↗" }],
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

const shortcutCls =
  "flex min-w-0 flex-1 items-center justify-between gap-1 rounded-md border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50";

/** 사이드바 아래: flex·직접 추가한 바로가기 버튼 + 저장소(연결된 시트 열기) */
function SidebarFooter({
  source,
  sheetUrl,
  shortcuts,
  onAdd,
  onEdit,
}: {
  source: DataSource;
  sheetUrl: string | null;
  shortcuts: Shortcut[];
  onAdd: () => void;
  onEdit: (s: Shortcut) => void;
}) {
  return (
    <div className="mx-3 mb-4 space-y-1.5">
      <a href={FLEX_URL} target="_blank" rel="noopener noreferrer" className={shortcutCls}>
        flex 열기
        <span aria-hidden>↗</span>
      </a>
      {shortcuts.map((s) => (
        <div key={s.id} className="group flex items-center gap-1">
          <a href={s.url} target="_blank" rel="noopener noreferrer" className={shortcutCls}>
            <span className="truncate">{s.name}</span>
            <span aria-hidden>↗</span>
          </a>
          <button
            onClick={() => onEdit(s)}
            aria-label={`${s.name} 버튼 수정`}
            title="수정"
            className="rounded px-1 py-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
          >
            ✎
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        title="사이드바 버튼 추가"
        className="ml-auto block rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        + 버튼 추가
      </button>
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

export function AppShell(props: {
  source: DataSource;
  /** 저장소 시트 주소 (Sheets 연결 시) */
  sheetUrl: string | null;
  initialShortcuts: Shortcut[];
  children: ReactNode;
}) {
  // 버튼 추가·삭제 창에서도 토스트를 쓰도록 사이드바까지 감싼다
  return (
    <ToastProvider>
      <Shell {...props} />
    </ToastProvider>
  );
}

function Shell({
  source,
  sheetUrl,
  initialShortcuts,
  children,
}: {
  source: DataSource;
  sheetUrl: string | null;
  initialShortcuts: Shortcut[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(initialShortcuts);
  const [modal, setModal] = useState<{ shortcut?: Shortcut } | null>(null);

  const footer = (
    <SidebarFooter
      source={source}
      sheetUrl={sheetUrl}
      shortcuts={shortcuts}
      onAdd={() => setModal({})}
      onEdit={(shortcut) => setModal({ shortcut })}
    />
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-200 bg-white md:flex">
        <div>
          <p className="px-5 pt-5 text-sm font-bold">업무 대시보드</p>
          <Nav />
        </div>
        {footer}
      </aside>

      {/* 모바일 메뉴 */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col justify-between overflow-y-auto bg-white shadow-xl">
            <div>
              <p className="px-5 pt-5 text-sm font-bold">업무 대시보드</p>
              <Nav onNavigate={() => setOpen(false)} />
            </div>
            {footer}
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

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>

      {modal && (
        <ShortcutFormModal
          shortcut={modal.shortcut}
          onClose={() => setModal(null)}
          onSaved={(s) => {
            setShortcuts((l) => upsert(l, s));
            setModal(null);
          }}
          onDeleted={(id) => {
            setShortcuts((l) => l.filter((s) => s.id !== id));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
