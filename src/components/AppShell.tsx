"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { api, upsert } from "@/lib/client-api";
import { LINK_CATEGORIES, type DataSource, type LinkCategory, type LinkItem } from "@/lib/types";
import { LinkFormModal } from "./forms";
import { SidebarLinks } from "./SidebarLinks";
import { ToastProvider, useToast } from "./Toast";
import { cn } from "./ui";

const NAV = [
  {
    group: "업무관리",
    items: [
      { href: "/", label: "홈", icon: "⌂" },
      { href: "/kanban", label: "칸반보드 · 캘린더", icon: "▦" },
    ],
  },
];

function Nav({ onNavigate, children }: { onNavigate?: () => void; children?: ReactNode }) {
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
      {children}
    </nav>
  );
}

/** 사이드바 링크 토글 중 펼쳐 둔 것 (localStorage) */
const OPEN_KEY = "sidebar-links-open";
const noSubscribe = () => () => {};
/** 펼쳐 둔 카테고리를 쉼표로 이은 문자열 */
function readOpenCategories() {
  try {
    return localStorage.getItem(OPEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 사이드바 아래: 저장소(연결된 시트 열기) */
function SidebarFooter({ source, sheetUrl }: { source: DataSource; sheetUrl: string | null }) {
  return (
    <div className="mx-3 mb-4">
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
  initialLinks: LinkItem[];
  children: ReactNode;
}) {
  // 링크 추가·삭제 창에서도 토스트를 쓰도록 사이드바까지 감싼다
  return (
    <ToastProvider>
      <Shell {...props} />
    </ToastProvider>
  );
}

function Shell({
  source,
  sheetUrl,
  initialLinks,
  children,
}: {
  source: DataSource;
  sheetUrl: string | null;
  initialLinks: LinkItem[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState(initialLinks);
  const [linkModal, setLinkModal] = useState<{ link?: LinkItem; category: LinkCategory } | null>(null);
  const toast = useToast();
  const router = useRouter();

  // 펼친 토글은 이 브라우저에 기억한다 (누르기 전에는 저장된 값을 보여 줌)
  const savedOpen = useSyncExternalStore(noSubscribe, readOpenCategories, () => "");
  const [editedOpen, setEditedOpen] = useState<LinkCategory[] | null>(null);
  const openCategories = editedOpen ?? LINK_CATEGORIES.filter((c) => savedOpen.split(",").includes(c));

  const toggleCategory = (c: LinkCategory) => {
    const next = openCategories.includes(c) ? openCategories.filter((x) => x !== c) : [...openCategories, c];
    setEditedOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next.join(","));
    } catch {}
  };

  /** 링크가 바뀌면 홈의 즐겨찾기도 새로 읽도록 서버 화면을 다시 불러온다 */
  const linksChanged = (update: (l: LinkItem[]) => LinkItem[]) => {
    setLinks(update);
    router.refresh();
  };

  /** 드래그로 정한 링크 순서를 저장. 먼저 화면에 반영하고 실패하면 되돌린다. */
  const reorderLinks = async (ids: string[]) => {
    const prev = links;
    const order = new Map(ids.map((id, i) => [id, i + 1]));
    setLinks((l) => l.map((x) => (order.has(x.id) ? { ...x, order: order.get(x.id)! } : x)));
    try {
      await api.reorderLinks(ids);
    } catch (e) {
      setLinks(prev);
      toast((e as Error).message, "error");
    }
  };

  const sidebarLinks = (
    <SidebarLinks
      links={links}
      openCategories={openCategories}
      onToggle={toggleCategory}
      onAdd={(category) => setLinkModal({ category })}
      onEdit={(link) => setLinkModal({ link, category: link.category })}
      onReorder={reorderLinks}
    />
  );

  const footer = <SidebarFooter source={source} sheetUrl={sheetUrl} />;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-200 bg-white md:flex">
        <div>
          <p className="px-5 pt-5 text-sm font-bold">업무 대시보드</p>
          <Nav>{sidebarLinks}</Nav>
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
              <Nav onNavigate={() => setOpen(false)}>{sidebarLinks}</Nav>
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

      {linkModal && (
        <LinkFormModal
          link={linkModal.link}
          category={linkModal.category}
          onClose={() => setLinkModal(null)}
          onSaved={(l) => {
            linksChanged((list) => upsert(list, l));
            setLinkModal(null);
          }}
          onDeleted={(id) => {
            linksChanged((list) => list.filter((x) => x.id !== id));
            setLinkModal(null);
          }}
        />
      )}
    </div>
  );
}
