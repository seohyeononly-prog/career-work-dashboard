"use client";

import { useState } from "react";
import { WEEKDAYS, diffDays, monthGrid, shortDate, todayStr } from "@/lib/date";
import { CATEGORIES, covers, rangeEnd, type Category, type Task } from "@/lib/types";
import { Button, CATEGORY_STYLE, cn } from "./ui";

const MAX_IN_CELL = 3;

type DragItem = { item: Task; from: string };

/** 업무 월 캘린더. 날짜 선택·월 이동·필터 상태는 부모(CalendarView)가 가진다. */
export function CalendarPanel({
  tasks,
  category,
  onCategoryChange,
  year,
  month,
  onMove,
  onToday,
  selected,
  onSelect,
  onOpenTask,
  onAddTask,
  onMoveTask,
}: {
  tasks: Task[];
  /** 카테고리 필터 (null = 전체). 걸러 낸 목록은 부모가 넘겨준다 */
  category: Category | null;
  onCategoryChange: (c: Category | null) => void;
  year: number;
  month: number;
  onMove: (delta: number) => void;
  onToday: () => void;
  selected: string;
  onSelect: (day: string) => void;
  onOpenTask: (t: Task) => void;
  /** 해당 날짜로 업무 추가 */
  onAddTask: (date: string) => void;
  /** 드래그로 날짜 옮기기: 기간 전체를 days만큼 민다 */
  onMoveTask: (t: Task, days: number) => void;
}) {
  const today = todayStr();
  /** '더보기'로 모든 항목을 펼친 날짜 */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  const cells = monthGrid(year, month);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  const tasksOn = (d: string) =>
    tasks.filter((t) => covers(t, d)).sort((a, b) => Number(a.status === "완료") - Number(b.status === "완료"));

  const dropOn = (d: string) => {
    const moving = drag;
    setDrag(null);
    setOverDay(null);
    if (!moving) return;
    const delta = diffDays(moving.from, d);
    if (delta) onMoveTask(moving.item, delta);
  };

  return (
    <section aria-label="캘린더" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold">캘린더</h2>
        <Button variant="primary" onClick={() => onAddTask(selected)}>
          + 새 업무
        </Button>
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
        <CategoryFilter value={category} onChange={onCategoryChange} />
      </div>

      <div className="overflow-hidden rounded-lg border border-t-4 border-slate-200 border-t-indigo-500 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-indigo-50/70 text-center text-xs text-indigo-900/70">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn("py-1.5", i === 0 && "text-rose-500", i === 6 && "text-blue-500")}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d.startsWith(monthPrefix);
            const items = tasksOn(d);
            const open = expanded === d;
            const shown = open ? items.length : MAX_IN_CELL;
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                aria-label={`${shortDate(d)} 업무 ${items.length}개`}
                aria-pressed={selected === d}
                onClick={() => onSelect(d)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(d)}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  if (overDay !== d) setOverDay(d);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(d);
                }}
                className={cn(
                  "group/cell min-h-16 min-w-0 cursor-pointer border-slate-100 p-1 text-left sm:min-h-28 sm:p-1.5",
                  i % 7 !== 6 && "border-r",
                  i < cells.length - 7 && "border-b",
                  !inMonth && "bg-slate-50/70",
                  selected === d && "bg-indigo-50/60 ring-1 ring-indigo-300 ring-inset",
                  drag && overDay === d && "bg-indigo-100/70 ring-2 ring-indigo-400 ring-inset",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      d === today ? "bg-indigo-600 font-bold text-white" : inMonth ? "text-slate-700" : "text-slate-300",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {/* 이 날짜에 바로 업무 추가 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(d);
                      onAddTask(d);
                    }}
                    aria-label={`${shortDate(d)}에 업무 추가`}
                    title="이 날 업무 추가"
                    className={cn(
                      "hidden h-5 w-5 items-center justify-center rounded text-sm leading-none text-slate-400 hover:bg-indigo-100 hover:text-indigo-700 sm:flex",
                      selected === d ? "opacity-100" : "opacity-0 group-hover/cell:opacity-100 focus:opacity-100",
                    )}
                  >
                    +
                  </button>
                </div>

                {/* 좁은 화면: 개수만 점으로 표시 */}
                {items.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                    {items.slice(0, 4).map((t) => (
                      <span
                        key={t.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          t.status === "완료" ? "bg-slate-300" : CATEGORY_STYLE[t.category].dot,
                        )}
                      />
                    ))}
                  </div>
                )}

                {/* 넓은 화면: 업무 제목 표시. 끌어서 다른 날짜에 놓으면 날짜가 바뀐다 */}
                <ul className="mt-1 hidden space-y-0.5 sm:block">
                  {items.slice(0, shown).map((t) => (
                    <li key={t.id}>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = "move";
                          setDrag({ item: t, from: d });
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setOverDay(null);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTask(t);
                        }}
                        className={cn(
                          "flex w-full cursor-grab items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-slate-100 active:cursor-grabbing",
                          drag?.item.id === t.id && "opacity-40",
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

/** 카테고리 필터: 전체 또는 하나. 고른 것을 다시 누르면 전체로 */
function CategoryFilter({ value, onChange }: { value: Category | null; onChange: (c: Category | null) => void }) {
  const btn = (on: boolean) =>
    cn(
      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
      on ? "border-slate-300 bg-slate-100 font-medium text-slate-800" : "border-transparent text-slate-500 hover:bg-slate-50",
    );
  return (
    <div role="group" aria-label="카테고리 필터" className="ml-auto flex flex-wrap items-center gap-1">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={btn(value === null)}>
        전체
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value === c}
          onClick={() => onChange(value === c ? null : c)}
          className={btn(value === c)}
        >
          <span className={cn("h-2 w-2 rounded-full", CATEGORY_STYLE[c].dot)} /> {c}
        </button>
      ))}
    </div>
  );
}
