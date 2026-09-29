"use client";

import { useState } from "react";
import { WEEKDAYS, monthGrid, shortDate, todayStr } from "@/lib/date";
import { CATEGORIES, covers, rangeEnd, type Schedule, type Task } from "@/lib/types";
import { Button, CATEGORY_STYLE, cn } from "./ui";

export type CalendarMode = "task" | "schedule";

const MAX_IN_CELL = 3;

/** 월 캘린더. 날짜 선택·월 이동 상태는 부모(WorkView)가 가진다. */
export function CalendarPanel({
  tasks,
  schedules,
  mode,
  onModeChange,
  year,
  month,
  onMove,
  onToday,
  selected,
  onSelect,
  onOpenTask,
  onOpenSchedule,
  onAdd,
}: {
  tasks: Task[];
  schedules: Schedule[];
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
  year: number;
  month: number;
  onMove: (delta: number) => void;
  onToday: () => void;
  selected: string;
  onSelect: (day: string) => void;
  onOpenTask: (t: Task) => void;
  onOpenSchedule: (s: Schedule) => void;
  /** 일정 추가 */
  onAdd: () => void;
}) {
  const today = todayStr();
  /** '더보기'로 모든 항목을 펼친 날짜 */
  const [expanded, setExpanded] = useState<string | null>(null);
  const days = monthGrid(year, month);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  const tasksOn = (d: string) =>
    tasks.filter((t) => covers(t, d)).sort((a, b) => Number(a.status === "완료") - Number(b.status === "완료"));
  const schedulesOn = (d: string) =>
    schedules.filter((s) => covers(s, d)).sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <section aria-label="캘린더" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold">캘린더</h2>
        <div role="tablist" aria-label="캘린더 보기" className="flex rounded-md border border-slate-200 bg-white p-0.5">
          {(
            [
              ["task", "업무 확인"],
              ["schedule", "일정 확인"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={mode === k}
              onClick={() => onModeChange(k)}
              className={cn(
                "rounded px-3 py-1 text-sm",
                mode === k ? "bg-indigo-600 font-medium text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* 업무 추가는 왼쪽 칸반보드의 버튼을 쓴다 */}
        {mode === "schedule" && (
          <Button variant="primary" onClick={onAdd}>
            + 새 일정
          </Button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Button className="px-2" onClick={() => onMove(-1)} aria-label="이전 달">
          ‹
        </Button>
        <span className="min-w-24 text-center text-sm font-semibold">
          {year}년 {month}월
        </span>
        <Button className="px-2" onClick={() => onMove(1)} aria-label="다음 달">
          ›
        </Button>
        <Button variant="ghost" onClick={onToday}>
          오늘
        </Button>
        <span className="ml-auto hidden items-center gap-3 text-xs text-slate-500 sm:flex">
          <Legend />
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn("py-1.5", i === 0 && "text-rose-500", i === 6 && "text-blue-500")}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const inMonth = d.startsWith(monthPrefix);
            const items = mode === "task" ? tasksOn(d) : schedulesOn(d);
            const open = expanded === d;
            const shown = open ? items.length : MAX_IN_CELL;
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                aria-label={`${shortDate(d)} 항목 ${items.length}개`}
                aria-pressed={selected === d}
                onClick={() => onSelect(d)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(d)}
                className={cn(
                  "min-h-16 min-w-0 cursor-pointer border-slate-100 p-1 text-left sm:min-h-28 sm:p-1.5",
                  i % 7 !== 6 && "border-r",
                  i < days.length - 7 && "border-b",
                  !inMonth && "bg-slate-50/70",
                  selected === d && "bg-indigo-50/60 ring-1 ring-indigo-300 ring-inset",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    d === today ? "bg-indigo-600 font-bold text-white" : inMonth ? "text-slate-700" : "text-slate-300",
                  )}
                >
                  {Number(d.slice(8))}
                </span>

                {/* 좁은 화면: 개수만 점으로 표시 */}
                {items.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                    {items.slice(0, 4).map((it) => (
                      <span
                        key={it.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          "status" in it && it.status === "완료" ? "bg-slate-300" : CATEGORY_STYLE[it.category].dot,
                        )}
                      />
                    ))}
                  </div>
                )}

                {/* 넓은 화면: 항목 제목 표시 */}
                <ul className="mt-1 hidden space-y-0.5 sm:block">
                  {mode === "task"
                    ? (items as Task[]).slice(0, shown).map((t) => (
                        <li key={t.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTask(t);
                            }}
                            className={cn(
                              "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-slate-100",
                              t.status === "완료"
                                ? "text-slate-400 line-through"
                                : rangeEnd(t) < today
                                  ? "text-rose-600"
                                  : "text-slate-700",
                            )}
                          >
                            {t.status === "완료" ? (
                              <span className="text-green-600" aria-label="완료">
                                ✓
                              </span>
                            ) : (
                              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CATEGORY_STYLE[t.category].dot)} />
                            )}
                            <span className="truncate">{t.title}</span>
                          </button>
                        </li>
                      ))
                    : (items as Schedule[]).slice(0, shown).map((s) => (
                        <li key={s.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSchedule(s);
                            }}
                            className={cn(
                              "flex w-full items-center truncate rounded px-1 py-0.5 text-left text-[11px] hover:opacity-80",
                              CATEGORY_STYLE[s.category].badge,
                            )}
                          >
                            <span className="truncate">{s.title}</span>
                          </button>
                        </li>
                      ))}
                  {items.length > MAX_IN_CELL && (
                    <li>
                      {/* 날짜 선택도 같이 되도록 클릭은 칸까지 전달한다 */}
                      <button
                        onClick={() => setExpanded(open ? null : d)}
                        aria-expanded={open}
                        className="w-full rounded px-1 py-0.5 text-left text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      >
                        {open ? "접기" : `+${items.length - MAX_IN_CELL}개 더보기`}
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Legend() {
  return (
    <>
      {CATEGORIES.map((c) => (
        <span key={c} className="flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full", CATEGORY_STYLE[c].dot)} /> {c}
        </span>
      ))}
    </>
  );
}
