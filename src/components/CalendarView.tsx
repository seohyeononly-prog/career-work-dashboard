"use client";

import { useState } from "react";
import { upsert } from "@/lib/client-api";
import { WEEKDAYS, datePart, monthGrid, shortDate, timePart, todayStr } from "@/lib/date";
import { useTasks } from "@/lib/use-tasks";
import type { Schedule, Task } from "@/lib/types";
import { ScheduleFormModal, TaskFormModal } from "./forms";
import { CompleteCheckbox, DueBadge } from "./TaskItem";
import { Button, CATEGORY_STYLE, CategoryBadge, Empty, ErrorNote, PageHeader, PriorityBadge, cn } from "./ui";

export type CalendarMode = "task" | "schedule";

const MAX_IN_CELL = 3;

type Modal =
  | { kind: "task"; task?: Task; date?: string }
  | { kind: "schedule"; schedule?: Schedule; date?: string }
  | null;

export function CalendarView({
  initialTasks,
  initialSchedules,
  initialMode,
}: {
  initialTasks: Task[];
  initialSchedules: Schedule[];
  initialMode: CalendarMode;
}) {
  const today = todayStr();
  const { tasks, busyId, error, toggle, save } = useTasks(initialTasks);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [mode, setModeState] = useState<CalendarMode>(initialMode);
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [selected, setSelected] = useState(today);
  const [modal, setModal] = useState<Modal>(null);

  const setMode = (m: CalendarMode) => {
    setModeState(m);
    const url = new URL(window.location.href);
    url.searchParams.set("view", m);
    window.history.replaceState(null, "", url);
  };

  const move = (delta: number) =>
    setYm(({ y, m }) => {
      const idx = y * 12 + (m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });
  const goToday = () => {
    setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
    setSelected(today);
  };

  const days = monthGrid(ym.y, ym.m);
  const monthPrefix = `${ym.y}-${String(ym.m).padStart(2, "0")}`;

  const tasksOn = (d: string) =>
    tasks.filter((t) => t.dueDate === d).sort((a, b) => Number(a.status === "완료") - Number(b.status === "완료"));
  const schedulesOn = (d: string) =>
    schedules
      .filter((s) => datePart(s.start) <= d && datePart(s.end) >= d)
      .sort((a, b) => a.start.localeCompare(b.start));

  const openTask = (task: Task) => setModal({ kind: "task", task });
  const openSchedule = (schedule: Schedule) => setModal({ kind: "schedule", schedule });

  return (
    <div>
      <PageHeader title="캘린더">
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
              onClick={() => setMode(k)}
              className={cn(
                "rounded px-3 py-1 text-sm",
                mode === k ? "bg-indigo-600 font-medium text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="primary" onClick={() => setModal({ kind: mode, date: selected })}>
          + {mode === "task" ? "새 업무" : "새 일정"}
        </Button>
      </PageHeader>

      <div className="mb-3 flex items-center gap-2">
        <Button className="px-2" onClick={() => move(-1)} aria-label="이전 달">
          ‹
        </Button>
        <span className="min-w-24 text-center text-sm font-semibold">
          {ym.y}년 {ym.m}월
        </span>
        <Button className="px-2" onClick={() => move(1)} aria-label="다음 달">
          ›
        </Button>
        <Button variant="ghost" onClick={goToday}>
          오늘
        </Button>
        <span className="ml-auto hidden items-center gap-3 text-xs text-slate-500 sm:flex">
          <Legend />
        </span>
      </div>
      {error && <div className="mb-3"><ErrorNote message={error} /></div>}

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
            const isToday = d === today;
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                aria-label={`${shortDate(d)} 항목 ${items.length}개`}
                onClick={() => setSelected(d)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(d)}
                className={cn(
                  "min-h-16 cursor-pointer border-slate-100 p-1 text-left sm:min-h-28 sm:p-1.5",
                  i % 7 !== 6 && "border-r",
                  i < days.length - 7 && "border-b",
                  !inMonth && "bg-slate-50/70",
                  selected === d && "bg-indigo-50/60 ring-1 ring-indigo-300 ring-inset",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isToday ? "bg-indigo-600 font-bold text-white" : inMonth ? "text-slate-700" : "text-slate-300",
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
                    ? (items as Task[]).slice(0, MAX_IN_CELL).map((t) => (
                        <li key={t.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openTask(t);
                            }}
                            className={cn(
                              "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-slate-100",
                              t.status === "완료"
                                ? "text-slate-400 line-through"
                                : t.dueDate < today
                                  ? "text-rose-600"
                                  : "text-slate-700",
                            )}
                          >
                            {t.status === "완료" ? (
                              <span className="text-green-600 no-underline" aria-label="완료">✓</span>
                            ) : (
                              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CATEGORY_STYLE[t.category].dot)} />
                            )}
                            <span className="truncate">{t.title}</span>
                          </button>
                        </li>
                      ))
                    : (items as Schedule[]).slice(0, MAX_IN_CELL).map((s) => (
                        <li key={s.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openSchedule(s);
                            }}
                            className={cn(
                              "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] text-slate-700 hover:opacity-80",
                              CATEGORY_STYLE[s.category].badge,
                            )}
                          >
                            {datePart(s.start) === d && <span className="shrink-0 font-medium">{timePart(s.start)}</span>}
                            <span className="truncate">{s.title}</span>
                          </button>
                        </li>
                      ))}
                  {items.length > MAX_IN_CELL && (
                    <li className="px-1 text-[11px] text-slate-400">+{items.length - MAX_IN_CELL}개 더보기</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택한 날짜 상세 */}
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4" aria-live="polite">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {shortDate(selected)} {mode === "task" ? "마감 업무" : "일정"}
          </h2>
          <Button className="text-xs" onClick={() => setModal({ kind: mode, date: selected })}>
            + 추가
          </Button>
        </div>
        {mode === "task" ? (
          tasksOn(selected).length ? (
            <ul className="divide-y divide-slate-100">
              {tasksOn(selected).map((t) => (
                <li key={t.id} className="flex items-start gap-2 py-2">
                  <CompleteCheckbox task={t} onToggle={toggle} disabled={busyId === t.id} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => openTask(t)}>
                    <span className={cn("block text-sm break-words", t.status === "완료" && "text-slate-400 line-through")}>
                      {t.title}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <CategoryBadge c={t.category} />
                      <PriorityBadge p={t.priority} />
                      <DueBadge task={t} />
                      <span className="text-xs text-slate-500">{t.status}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>마감 업무가 없습니다.</Empty>
          )
        ) : schedulesOn(selected).length ? (
          <ul className="divide-y divide-slate-100">
            {schedulesOn(selected).map((s) => (
              <li key={s.id}>
                <button className="w-full py-2 text-left" onClick={() => openSchedule(s)}>
                  <span className="block text-sm font-medium break-words">{s.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <CategoryBadge c={s.category} />
                    {shortDate(datePart(s.start))} {timePart(s.start)} ~{" "}
                    {datePart(s.end) !== datePart(s.start) && shortDate(datePart(s.end))} {timePart(s.end)}
                    {s.location && <span>· {s.location}</span>}
                  </span>
                  {s.description && <span className="mt-1 block text-xs text-slate-500">{s.description}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>일정이 없습니다.</Empty>
        )}
      </section>

      {modal?.kind === "task" && (
        <TaskFormModal
          task={modal.task}
          defaults={{ dueDate: modal.date }}
          onClose={() => setModal(null)}
          onSaved={(t) => {
            save(t);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "schedule" && (
        <ScheduleFormModal
          schedule={modal.schedule}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
          onSaved={(s) => {
            setSchedules((l) => upsert(l, s));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <>
      <span className="flex items-center gap-1">
        <span className={cn("h-2 w-2 rounded-full", CATEGORY_STYLE["취업운영"].dot)} /> 취업운영
      </span>
      <span className="flex items-center gap-1">
        <span className={cn("h-2 w-2 rounded-full", CATEGORY_STYLE["일경험"].dot)} /> 일경험
      </span>
    </>
  );
}
