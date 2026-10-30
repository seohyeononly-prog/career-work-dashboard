"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { shortDate } from "@/lib/date";
import type { WbsChange, WbsPlan } from "@/lib/wbs";
import { Button, Empty, ErrorNote, Modal, cn } from "./ui";

const KINDS: { kind: WbsChange["kind"]; label: string; style: string; where: (row: number) => string }[] = [
  { kind: "add", label: "추가", style: "bg-emerald-50 text-emerald-700", where: (row) => `${row}행 아래` },
  { kind: "update", label: "수정", style: "bg-sky-50 text-sky-700", where: (row) => `${row}행` },
  { kind: "link", label: "ID 연결", style: "bg-slate-100 text-slate-600", where: (row) => `${row}행 N열` },
  { kind: "remove", label: "삭제", style: "bg-rose-50 text-rose-700", where: (row) => `${row}행` },
];

/** WBS 동기화: 바뀔 내용을 먼저 보여 주고, 반영을 눌러야 시트를 고친다 */
export function WbsSyncModal({ onClose, onApplied }: { onClose: () => void; onApplied: (count: number) => void }) {
  const [plan, setPlan] = useState<WbsPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .planWbs()
      .then((p) => alive && setPlan(p))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const apply = async () => {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      onApplied((await api.applyWbs(plan.token)).applied);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title="WBS 동기화" onClose={onClose}>
      {error && (
        <div className="mb-3">
          <ErrorNote message={error} />
        </div>
      )}
      {!plan && !error && <Empty>WBS 시트와 비교하는 중…</Empty>}
      {plan && (
        <>
          <p className="mb-3 text-xs text-slate-500">
            {shortDate(plan.from)} ~ {shortDate(plan.to)}에 걸친 업무만 새로 넣어요. 지난 업무는 그대로 두고, 대시보드에서 지운 업무의 행만 지워요.
          </p>
          {plan.missing.length > 0 && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {plan.missing.join(", ")} 구역에서 내 업무 행을 찾지 못해 추가하지 않아요. 그 구역에 한 줄을 먼저 붙여 넣어 주세요.
            </p>
          )}
          {!plan.changes.length ? (
            <Empty>WBS 시트가 이미 칸반과 같아요.</Empty>
          ) : (
            <div className="space-y-3">
              {KINDS.map(({ kind, label, style, where }) => {
                const list = plan.changes.filter((c) => c.kind === kind);
                if (!list.length) return null;
                return (
                  <section key={kind}>
                    <h3 className="mb-1 text-sm font-semibold">
                      {label} {list.length}건
                    </h3>
                    <ul className="space-y-1">
                      {list.map((c, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs", style)}>{where(c.row)}</span>
                          <span className="min-w-0 truncate" title={c.name}>
                            {c.name || "(업무명 없음)"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
        <Button variant="primary" onClick={apply} disabled={!plan?.changes.length || busy}>
          {busy ? "반영하는 중…" : "시트에 반영"}
        </Button>
      </div>
    </Modal>
  );
}
