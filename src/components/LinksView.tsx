"use client";

import { useState } from "react";
import { api, upsert } from "@/lib/client-api";
import { LINK_CATEGORIES, SERVICE_TYPES, byLinkOrder, type LinkCategory, type LinkItem } from "@/lib/types";
import { LinkFormModal } from "./forms";
import { Button, CATEGORY_STYLE, Empty, ErrorNote, PageHeader, cn } from "./ui";

const COLUMN_STYLE: Record<LinkCategory, string> = {
  취업운영: "border-t-indigo-500",
  일경험: "border-t-emerald-500",
};

/** 취업운영 | 일경험 두 열, 열 안에서는 서비스 종류별로 묶어 보여 준다 */
export function LinksView({ initialLinks }: { initialLinks: LinkItem[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [modal, setModal] = useState<{ link?: LinkItem; category: LinkCategory } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<{ id: string; over?: { id: string; after: boolean } } | null>(null);

  const apply = (l: LinkItem) => setLinks((list) => upsert(list, l));

  const toggleFavorite = async (l: LinkItem) => {
    setError("");
    setBusyId(l.id);
    apply({ ...l, favorite: !l.favorite });
    try {
      apply(await api.updateLink(l.id, { favorite: !l.favorite }));
    } catch (e) {
      apply(l);
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const groupOf = (l: LinkItem) => links.filter((x) => x.category === l.category && x.service === l.service).sort(byLinkOrder);
  const sameGroup = (a: LinkItem, b: LinkItem) => a.category === b.category && a.service === b.service;

  /** 끌던 링크를 같은 그룹(카테고리 + 서비스)의 대상 링크 앞/뒤로 옮기고, 그룹 전체에 순서를 다시 매긴다 */
  const dropOn = async (target: LinkItem, after: boolean) => {
    const moving = links.find((l) => l.id === drag?.id);
    setDrag(null);
    if (!moving || moving.id === target.id || !sameGroup(moving, target)) return;
    const group = groupOf(target);
    const rest = group.filter((l) => l.id !== moving.id);
    const at = rest.findIndex((l) => l.id === target.id) + (after ? 1 : 0);
    const next = [...rest.slice(0, at), moving, ...rest.slice(at)];
    if (next.every((l, i) => l.id === group[i].id && l.order === i + 1)) return;

    setError("");
    const prev = links;
    const order = new Map(next.map((l, i) => [l.id, i + 1]));
    setLinks((list) => list.map((l) => (order.has(l.id) ? { ...l, order: order.get(l.id)! } : l)));
    try {
      await api.reorderLinks(next.map((l) => l.id));
    } catch (e) {
      setLinks(prev);
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="자주 보는 링크" />
      {error && (
        <div className="mb-3">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {LINK_CATEGORIES.map((category) => {
          const inCategory = links.filter((l) => l.category === category);
          return (
            <section
              key={category}
              aria-label={`${category} 링크`}
              className={cn(
                "min-w-0 rounded-lg border border-t-4 border-slate-200 bg-slate-50",
                COLUMN_STYLE[category],
              )}
            >
              <header className="flex items-center gap-2 px-4 py-3">
                <span className={cn("h-2 w-2 rounded-full", CATEGORY_STYLE[category].dot)} aria-hidden />
                <h2 className="text-sm font-semibold">{category}</h2>
                <span className="mr-auto text-xs text-slate-500">{inCategory.length}</span>
                <Button className="text-xs" onClick={() => setModal({ category })}>
                  + 새 링크
                </Button>
              </header>

              <div className="space-y-3 px-3 pb-3">
                {SERVICE_TYPES.map((service) => {
                  const list = inCategory.filter((l) => l.service === service).sort(byLinkOrder);
                  if (!list.length) return null;
                  return (
                    <div key={service}>
                      <h3 className="mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-600">
                        {service}
                        <span className="font-normal text-slate-400">{list.length}</span>
                      </h3>
                      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
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
                                "group/row flex cursor-grab items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 active:cursor-grabbing",
                                busyId === l.id && "opacity-60",
                                drag?.id === l.id && "opacity-40",
                                over && (over.after ? "shadow-[inset_0_-2px_0_var(--color-indigo-500)]" : "shadow-[inset_0_2px_0_var(--color-indigo-500)]"),
                              )}
                            >
                              <button
                                onClick={() => toggleFavorite(l)}
                                disabled={busyId === l.id}
                                aria-pressed={l.favorite}
                                aria-label={l.favorite ? `${l.name} 즐겨찾기 해제` : `${l.name} 즐겨찾기`}
                                title="즐겨찾기하면 홈 화면에 보여요"
                                className={cn(
                                  "text-sm leading-none",
                                  l.favorite ? "text-amber-400" : "text-slate-200 hover:text-slate-400",
                                )}
                              >
                                {l.favorite ? "★" : "☆"}
                              </button>
                              {/* 링크 자체를 끌면 주소가 끌려가므로 행 전체가 끌리도록 막는다 */}
                              <a
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                draggable={false}
                                className="group min-w-0 flex-1"
                              >
                                <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-indigo-600 group-hover:underline">
                                  {l.name}
                                </span>
                                {l.description && (
                                  <span className="block truncate text-xs text-slate-500">{l.description}</span>
                                )}
                              </a>
                              <Button
                                variant="ghost"
                                className="shrink-0 text-xs text-slate-400 md:opacity-0 md:group-hover/row:opacity-100 md:focus:opacity-100"
                                onClick={() => setModal({ link: l, category })}
                              >
                                수정
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                {!inCategory.length && (
                  <div className="rounded-md border border-dashed border-slate-300 bg-white p-4">
                    <Empty>등록된 링크가 없습니다.</Empty>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {modal && (
        <LinkFormModal
          link={modal.link}
          category={modal.category}
          onClose={() => setModal(null)}
          onSaved={(l) => {
            apply(l);
            setModal(null);
          }}
          onDeleted={(id) => {
            setLinks((list) => list.filter((x) => x.id !== id));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
