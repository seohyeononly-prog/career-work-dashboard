"use client";

import { useState } from "react";
import { LINK_CATEGORIES, SERVICE_TYPES, byLinkOrder, type LinkCategory, type LinkItem } from "@/lib/types";
import { ServiceMark } from "./ServiceMark";
import { LINK_CATEGORY_DOT, cn } from "./ui";

/** 카테고리 안에서는 서비스 종류 → 드래그로 정한 순서 */
const byServiceThenOrder = (a: LinkItem, b: LinkItem) =>
  SERVICE_TYPES.indexOf(a.service) - SERVICE_TYPES.indexOf(b.service) || byLinkOrder(a, b);

const sameGroup = (a: LinkItem, b: LinkItem) => a.category === b.category && a.service === b.service;

/** 사이드바의 자주 보는 링크: 일경험 · 취업운영 · 교육사업본부 토글, 안에서는 서비스 종류별로 모아 보여 준다 */
export function SidebarLinks({
  links,
  openCategories,
  onToggle,
  onAdd,
  onEdit,
  onReorder,
}: {
  links: LinkItem[];
  openCategories: LinkCategory[];
  onToggle: (c: LinkCategory) => void;
  onAdd: (c: LinkCategory) => void;
  onEdit: (l: LinkItem) => void;
  /** 같은 그룹(카테고리 + 서비스) 안에서 드래그로 바꾼 순서(ids) */
  onReorder: (ids: string[]) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; over?: { id: string; after: boolean } } | null>(null);

  /** 끌던 링크를 같은 그룹의 대상 링크 앞/뒤로 옮긴다 */
  const dropOn = (target: LinkItem, after: boolean) => {
    const moving = links.find((l) => l.id === drag?.id);
    setDrag(null);
    if (!moving || moving.id === target.id || !sameGroup(moving, target)) return;
    const group = links.filter((l) => sameGroup(l, target)).sort(byLinkOrder);
    const rest = group.filter((l) => l.id !== moving.id);
    const at = rest.findIndex((l) => l.id === target.id) + (after ? 1 : 0);
    const next = [...rest.slice(0, at), moving, ...rest.slice(at)];
    if (next.every((l, i) => l.id === group[i].id && l.order === i + 1)) return;
    onReorder(next.map((l) => l.id));
  };

  return (
    <div>
      <p className="mb-1 px-2 text-xs font-semibold text-slate-500">자주 보는 링크</p>
      <div className="space-y-0.5">
        {LINK_CATEGORIES.map((category) => {
          const list = links.filter((l) => l.category === category).sort(byServiceThenOrder);
          const open = openCategories.includes(category);
          return (
            // 펼친 토글은 제목과 링크 목록을 회색 상자 하나로 묶는다
            <div key={category} className={cn("rounded-md", open && "bg-slate-100 pb-1")}>
              <div className={cn("group flex items-center rounded-md", open ? "hover:bg-slate-200/60" : "hover:bg-slate-100")}>
                <button
                  onClick={() => onToggle(category)}
                  aria-expanded={open}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm",
                    open ? "font-medium text-slate-800" : "text-slate-600",
                  )}
                >
                  <span className={cn("w-4 text-center text-[10px] text-slate-400 transition-transform", open && "rotate-90")} aria-hidden>
                    ▶
                  </span>
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", LINK_CATEGORY_DOT[category])} aria-hidden />
                  {category}
                  <span className="text-xs text-slate-400">{list.length}</span>
                </button>
                <button
                  onClick={() => onAdd(category)}
                  aria-label={`${category} 링크 추가`}
                  title="링크 추가"
                  className="mr-1 rounded px-1.5 text-sm text-slate-400 hover:bg-slate-200 hover:text-slate-700 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                >
                  +
                </button>
              </div>

              {open && (
                <ul className="ml-4 mr-1 border-l border-slate-300 pl-1">
                  {list.map((l) => {
                    const over = drag?.over?.id === l.id ? drag.over : null;
                    return (
                      <li
                        key={l.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          setDrag({ id: l.id });
                        }}
                        onDragEnd={() => setDrag(null)}
                        onDragOver={(e) => {
                          const moving = drag && links.find((x) => x.id === drag.id);
                          if (!moving || moving.id === l.id || !sameGroup(moving, l)) return;
                          e.preventDefault();
                          const r = e.currentTarget.getBoundingClientRect();
                          const after = e.clientY > r.top + r.height / 2;
                          if (over?.after !== after) setDrag({ id: moving.id, over: { id: l.id, after } });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (over) dropOn(l, over.after);
                        }}
                        className={cn(
                          "group/row flex cursor-grab items-center gap-1 rounded-md hover:bg-white active:cursor-grabbing",
                          drag?.id === l.id && "opacity-40",
                          over && (over.after ? "shadow-[0_2px_0_var(--color-indigo-500)]" : "shadow-[0_-2px_0_var(--color-indigo-500)]"),
                        )}
                      >
                        {/* 링크 자체를 끌면 주소가 끌려가므로 행 전체가 끌리도록 막는다 */}
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          draggable={false}
                          title={l.description ? `${l.name} — ${l.description}` : l.name}
                          className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-1 text-xs text-slate-700 hover:text-indigo-600"
                        >
                          <ServiceMark service={l.service} small />
                          <span className="truncate">{l.name}</span>
                          {l.favorite && (
                            <span className="shrink-0 text-[10px] text-amber-400" aria-label="즐겨찾기">
                              ★
                            </span>
                          )}
                        </a>
                        <button
                          onClick={() => onEdit(l)}
                          aria-label={`${l.name} 링크 수정`}
                          title="수정"
                          className="rounded px-1 py-0.5 text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-700 md:opacity-0 md:group-hover/row:opacity-100 md:focus:opacity-100"
                        >
                          ✎
                        </button>
                      </li>
                    );
                  })}
                  {!list.length && <li className="px-1.5 py-1 text-xs text-slate-400">등록된 링크가 없습니다.</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
