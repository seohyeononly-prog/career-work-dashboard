"use client";

import { useState } from "react";
import { api, upsert } from "@/lib/client-api";
import { SERVICE_TYPES, type LinkCategory, type LinkItem, type ServiceType } from "@/lib/types";
import { LinkFormModal } from "./forms";
import { ServiceMark } from "./ServiceMark";
import { Button, Empty, ErrorNote, PageHeader, Select, cn } from "./ui";

export function LinksView({ category, initialLinks }: { category: LinkCategory; initialLinks: LinkItem[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [service, setService] = useState<ServiceType | "전체">("전체");
  const [modal, setModal] = useState<{ link?: LinkItem } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // 수정하면서 다른 카테고리로 옮긴 링크는 이 화면에서 뺀다
  const apply = (l: LinkItem) =>
    setLinks((list) => (l.category === category ? upsert(list, l) : list.filter((x) => x.id !== l.id)));

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

  const visible = links
    .filter((l) => service === "전체" || l.service === service)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, "ko"));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`자주 보는 링크 · ${category}`}>
        <Select
          ariaLabel="서비스 종류 필터"
          className="w-auto"
          value={service}
          options={[{ value: "전체", label: "서비스 전체" }, ...SERVICE_TYPES.map((s) => ({ value: s, label: s }))]}
          onChange={setService}
        />
        <Button variant="primary" onClick={() => setModal({})}>
          + 새 링크
        </Button>
      </PageHeader>
      {error && <div className="mb-3"><ErrorNote message={error} /></div>}

      {visible.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {visible.map((l) => (
            <li key={l.id} className={cn("flex items-center gap-3 px-3 py-2.5 sm:px-4", busyId === l.id && "opacity-60")}>
              <button
                onClick={() => toggleFavorite(l)}
                disabled={busyId === l.id}
                aria-pressed={l.favorite}
                aria-label={l.favorite ? `${l.name} 즐겨찾기 해제` : `${l.name} 즐겨찾기`}
                className={cn("text-lg leading-none", l.favorite ? "text-amber-400" : "text-slate-300 hover:text-slate-400")}
              >
                {l.favorite ? "★" : "☆"}
              </button>
              <ServiceMark service={l.service} />
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="group min-w-0 flex-1">
                <span className="block truncate text-sm font-medium group-hover:text-indigo-600 group-hover:underline">
                  {l.name}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {l.service}
                  {l.description && ` · ${l.description}`}
                </span>
              </a>
              <Button variant="ghost" className="shrink-0 text-xs" onClick={() => setModal({ link: l })}>
                수정
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
          <Empty>등록된 링크가 없습니다.</Empty>
        </div>
      )}

      {modal && (
        <LinkFormModal
          link={modal.link}
          category={category}
          onClose={() => setModal(null)}
          onSaved={(l) => {
            apply(l);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
