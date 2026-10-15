"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { diffDays, shortDate, weekdayOf } from "@/lib/date";
import { rangeEnd, type Category, type Task, type TaskInput } from "@/lib/types";
import { WBS_OWNER, WBS_SECTION, wbsFields } from "@/lib/wbs";
import { Button, cn } from "./ui";

/** 표 묶음 순서: 루틴 → 칸반 열 순서 */
const GROUPS: readonly Category[] = ["취업운영", "일경험", "기타"];

/** WBS 시트와 같은 열. 중요도·KPI는 시트에 붙인 뒤 직접 채운다 */
const COLUMNS = [
  { name: "구분", w: "w-24" },
  { name: "담당자", w: "w-16" },
  { name: "T1", w: "w-28" },
  { name: "T2", w: "w-14" },
  { name: "T3", w: "" },
  { name: "중요도", w: "w-14" },
  { name: "KPI", w: "w-12" },
  { name: "시작일", w: "w-24" },
  { name: "완료일", w: "w-24" },
  { name: "작업일", w: "w-14" },
  { name: "완료여부", w: "w-14" },
  { name: "지연여부", w: "w-14" },
  { name: "비고", w: "w-40" },
] as const;
const START_COL = 7;
const END_COL = 8;
const LAST_COL = COLUMNS.length - 1;

type Row = { kind: "group"; label: string; count: number } | { kind: "task"; task: Task };
type Cell = [row: number, col: number];
type Selection = { anchor: Cell; focus: Cell };

/** 마감까지 남은 날: 앞이면 D-n, 오늘·지난 날이면 D+n (시트와 같은 표기) */
const dayLabel = (n: number) => (n > 0 ? `D-${n}` : `D+${-n}`);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** 복사할 때 칸마다 들어갈 값. 날짜는 시트가 날짜로 알아보도록 YYYY-MM-DD */
function cellValues(row: Row, today: string): string[] {
  if (row.kind === "group") return [row.label, ...Array(LAST_COL).fill("")];
  const t = row.task;
  const w = wbsFields(t);
  const end = rangeEnd(t);
  const done = t.status === "완료";
  return [
    t.routineId ? `루틴(${weekdayOf(t.startDate)})` : w.group,
    WBS_OWNER,
    w.org,
    w.type,
    w.name,
    "",
    "",
    t.startDate,
    end,
    dayLabel(diffDays(today, end)),
    done ? "완료" : "",
    !done && end < today ? "지연" : "",
    [oneLine(t.memo), t.link].filter(Boolean).join(" "),
  ];
}

/**
 * 칸반 아래 업무 목록 표 (WBS 시트 모양).
 * 칸을 끌어서 고르고 Ctrl+C로 복사하면 시트에 칸마다 나뉘어 붙는다.
 * 시작일·완료일 칸은 두 번 누르면 날짜를 고를 수 있다.
 */
export function TaskTable({
  tasks,
  today,
  hideDone,
  busyId,
  onToggle,
  onPatch,
  onOpen,
  onCopied,
}: {
  /** 표에 넣을 업무 (저장된 업무 + 앞으로 일주일의 루틴 카드) */
  tasks: Task[];
  today: string;
  hideDone: boolean;
  busyId: string | null;
  onToggle: (t: Task, done: boolean) => void;
  onPatch: (t: Task, patch: Partial<TaskInput>) => void;
  onOpen: (t: Task) => void;
  onCopied: (text: string, count: number) => void;
}) {
  const [sel, setSel] = useState<Selection | null>(null);
  const dragging = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  const shown = tasks.filter((t) => !(hideDone && t.status === "완료"));
  const byDate = (a: Task, b: Task) =>
    a.startDate.localeCompare(b.startDate) || rangeEnd(a).localeCompare(rangeEnd(b)) || a.title.localeCompare(b.title, "ko");
  const groups = [
    { label: "루틴", list: shown.filter((t) => t.routineId) },
    ...GROUPS.map((c) => ({ label: WBS_SECTION[c], list: shown.filter((t) => !t.routineId && t.category === c) })),
  ];
  const rows: Row[] = groups.flatMap((g) => [
    { kind: "group", label: g.label, count: g.list.length } as const,
    ...g.list.sort(byDate).map((task) => ({ kind: "task", task }) as const),
  ]);

  // 행이 줄어 선택이 표 밖을 가리키면 버린다
  const range =
    sel && Math.max(sel.anchor[0], sel.focus[0]) < rows.length
      ? {
          r0: Math.min(sel.anchor[0], sel.focus[0]),
          r1: Math.max(sel.anchor[0], sel.focus[0]),
          c0: Math.min(sel.anchor[1], sel.focus[1]),
          c1: Math.max(sel.anchor[1], sel.focus[1]),
        }
      : null;
  const inRange = (r: number, c: number) => !!range && r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1;

  const copy = (r0: number, r1: number, c0: number, c1: number) => {
    const lines = rows.slice(r0, r1 + 1).map((row) => cellValues(row, today).slice(c0, c1 + 1).join("\t"));
    onCopied(lines.join("\n"), lines.length);
  };
  const copyAll = () => copy(0, rows.length - 1, 0, LAST_COL);

  const down = (e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0) return;
    boxRef.current?.focus({ preventScroll: true });
    if (e.shiftKey && sel) {
      setSel({ anchor: sel.anchor, focus: [r, c] });
      return;
    }
    dragging.current = true;
    setSel({ anchor: [r, c], focus: [r, c] });
  };
  const enter = (r: number, c?: number) => {
    if (dragging.current && sel) setSel({ anchor: sel.anchor, focus: [r, c ?? sel.focus[1]] });
  };

  /** 날짜 칸 안의 숨은 날짜 입력에서 달력을 연다 */
  const openPicker = (el: HTMLElement | null) => {
    try {
      el?.querySelector<HTMLInputElement>("input[type=date]")?.showPicker();
    } catch {}
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      setSel({ anchor: [0, 0], focus: [rows.length - 1, LAST_COL] });
    } else if (mod && e.key.toLowerCase() === "c" && range) {
      e.preventDefault();
      copy(range.r0, range.r1, range.c0, range.c1);
    } else if (e.key === "Escape") {
      setSel(null);
    } else if (e.key === "Enter" && range && range.r0 === range.r1 && range.c0 === range.c1) {
      openPicker(boxRef.current?.querySelector(`[data-cell="${range.r0}-${range.c0}"]`) ?? null);
    }
  };

  /** 시작일을 완료일 뒤로 옮기면 하루짜리로, 완료일을 시작일 이전·같은 날로 두면 하루짜리로 */
  const changeDate = (t: Task, col: number, v: string) => {
    if (col === START_COL) {
      if (!v || v === t.startDate) return;
      onPatch(t, { startDate: v, endDate: t.endDate && t.endDate > v ? t.endDate : "" });
    } else {
      const endDate = v && v > t.startDate ? v : "";
      if (endDate !== t.endDate) onPatch(t, { endDate });
    }
  };

  const renderTaskRow = (t: Task, r: number) => {
    const end = rangeEnd(t);
    const left = diffDays(today, end);
    const done = t.status === "완료";
    const late = !done && left < 0;
    const soon = !done && left >= 0 && left <= 1;
    const values = cellValues({ kind: "task", task: t }, today);

    const content = (c: number): ReactNode => {
      if (c === START_COL || c === END_COL) {
        const ymd = c === START_COL ? t.startDate : end;
        if (c === START_COL && t.routineId) return shortDate(ymd);
        return (
          <>
            {shortDate(ymd)}
            <input
              type="date"
              tabIndex={-1}
              aria-label={`${t.title} ${COLUMNS[c].name}`}
              value={ymd}
              onChange={(e) => changeDate(t, c, e.target.value)}
              className="pointer-events-none absolute inset-0 opacity-0"
            />
          </>
        );
      }
      if (c === 10)
        return (
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer align-middle accent-indigo-600"
            checked={done}
            disabled={busyId === t.id}
            onChange={(e) => onToggle(t, e.target.checked)}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={`${t.title} 완료 처리`}
          />
        );
      if (c === LAST_COL)
        return (
          <>
            {oneLine(t.memo)}
            {t.link && (
              <a
                href={t.link}
                target="_blank"
                rel="noopener noreferrer"
                onMouseDown={(e) => e.stopPropagation()}
                title={t.link}
                className="ml-1 text-indigo-600 hover:underline"
              >
                링크
              </a>
            )}
          </>
        );
      return values[c];
    };

    return (
      <tr key={t.id} className={cn(soon && "bg-amber-50 font-semibold", done && "text-slate-400")}>
        {COLUMNS.map((col, c) => {
          // 루틴 업무는 시작일이 곧 루틴이 생기는 날이라 옮기지 않는다 (옮기면 그날 루틴 카드가 다시 생김)
          const isDate = c === END_COL || (c === START_COL && !t.routineId);
          const todayCell = (c === START_COL || c === END_COL) && (c === START_COL ? t.startDate : end) === today;
          return (
            <td
              key={col.name}
              data-cell={`${r}-${c}`}
              onMouseDown={(e) => down(e, r, c)}
              onMouseEnter={() => enter(r, c)}
              onDoubleClick={(e) => (isDate ? openPicker(e.currentTarget) : c === 4 && onOpen(t))}
              title={isDate ? "두 번 눌러 날짜 바꾸기" : c === 4 ? "두 번 눌러 업무 열기" : undefined}
              className={cn(
                "relative truncate border-r border-b border-slate-200 px-1.5 py-1",
                (c === START_COL || c === END_COL || c === 1 || c === 5 || c >= 9) && c !== LAST_COL && "text-center",
                c === 1 && "bg-sky-100/70",
                inRange(r, c) ? "bg-indigo-100!" : todayCell && "bg-yellow-200",
                late && (c === END_COL || c === 9 || c === 11) && "text-rose-600",
              )}
            >
              {content(c)}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <section aria-label="업무 목록" className="mt-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">업무 목록</h2>
        <span className="mr-auto text-xs text-slate-500">
          {shown.length}건 · 칸을 끌어서 고르고 Ctrl+C로 복사 · 날짜 칸은 두 번 눌러 바꾸기
        </span>
        <Button onClick={copyAll}>표 전체 복사</Button>
      </div>
      <div
        ref={boxRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="overflow-x-auto rounded-md border border-slate-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
      >
        <table className="w-full min-w-[1100px] table-fixed border-collapse text-xs select-none">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.name} className={cn("bg-slate-800 px-1.5 py-1.5 font-semibold text-white", col.w)}>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) =>
              row.kind === "task" ? (
                renderTaskRow(row.task, r)
              ) : (
                <tr key={`g-${row.label}`}>
                  <td
                    colSpan={COLUMNS.length}
                    onMouseDown={(e) => down(e, r, 0)}
                    onMouseEnter={() => enter(r)}
                    className={cn(
                      "border-b border-slate-200 px-1.5 py-1 font-semibold text-slate-600",
                      range && r >= range.r0 && r <= range.r1 ? "bg-indigo-100" : "bg-slate-200",
                    )}
                  >
                    {row.label}
                    <span className="ml-1.5 font-normal text-slate-500">{row.count}</span>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
