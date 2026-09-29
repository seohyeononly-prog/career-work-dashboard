"use client";

import { useState } from "react";
import { upsert } from "@/lib/client-api";
import { addDays, fullDate, todayStr } from "@/lib/date";
import { useTasks } from "@/lib/use-tasks";
import { CATEGORIES, TASK_STATUSES, covers, type Category, type Schedule, type Task, type TaskStatus } from "@/lib/types";
import { CalendarPanel, type CalendarMode } from "./CalendarPanel";
import { ScheduleFormModal, TaskFormModal } from "./forms";
import { TaskCard } from "./TaskItem";
import { Button, Empty, ErrorNote, Select, cn, inputCls } from "./ui";

type All = "전체";

type Modal =
  | { kind: "task"; task?: Task; date?: string }
  | { kind: "schedule"; schedule?: Schedule; date?: string }
  | null;

const COLUMN_STYLE: Record<TaskStatus, string> = {
  대기: "border-t-slate-400",
  완료: "border-t-green-500",
};

const ymOf = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) });

/** 칸반보드(왼쪽) + 캘린더(오른쪽) 한 화면 */
export function WorkView({
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
  const [date, setDate] = useState(today);
  const [ym, setYm] = useState(ymOf(today));
  const [mode, setModeState] = useState<CalendarMode>(initialMode);
  const [category, setCategory] = useState<Category | All>("전체");
  const [status, setStatus] = useState<TaskStatus | All>("전체");
  const [modal, setModal] = useState<Modal>(null);

  /** 날짜를 고르면 칸반보드가 바뀌고, 캘린더도 그 달로 이동한다 */
  const selectDate = (d: string) => {
    if (!d) return;
    setDate(d);
    setYm(ymOf(d));
  };
  const moveMonth = (delta: number) =>
    setYm(({ y, m }) => {
      const idx = y * 12 + (m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });
  const setMode = (m: CalendarMode) => {
    setModeState(m);
    const url = new URL(window.location.href);
    url.searchParams.set("view", m);
    window.history.replaceState(null, "", url);
  };

  const dayTasks = tasks
    .filter((t) => covers(t, date) && (category === "전체" || t.category === category))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, "ko"));
  const columns = status === "전체" ? TASK_STATUSES : [status];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
      {/* ---------- 칸반보드 ---------- */}
      <section aria-label="칸반보드" className="min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <h1 className="mr-auto text-base font-semibold">칸반보드</h1>
          <Button variant="primary" onClick={() => setModal({ kind: "task", date })}>
            + 새 업무
          </Button>
        </div>

        <div className="mb-2 flex items-center gap-1.5">
          <Button className="px-2" onClick={() => selectDate(addDays(date, -1))} aria-label="전날">
            ‹
          </Button>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">날짜 선택</span>
            <input
              type="date"
              value={date}
              onChange={(e) => selectDate(e.target.value)}
              className={cn(inputCls, "text-center font-semibold text-transparent")}
            />
            {/* 요일까지 보이도록 날짜 입력 위에 표시 */}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center pr-6 text-sm font-semibold">
              {fullDate(date)}
            </span>
          </label>
          <Button className="px-2" onClick={() => selectDate(addDays(date, 1))} aria-label="다음 날">
            ›
          </Button>
          <Button variant="ghost" onClick={() => selectDate(today)} disabled={date === today}>
            오늘
          </Button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <Select
            ariaLabel="카테고리 필터"
            value={category}
            options={[{ value: "전체", label: "카테고리 전체" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
            onChange={setCategory}
          />
          <Select
            ariaLabel="상태 필터"
            value={status}
            options={[{ value: "전체", label: "상태 전체" }, ...TASK_STATUSES.map((s) => ({ value: s, label: s }))]}
            onChange={setStatus}
          />
        </div>
        {error && (
          <div className="mb-3">
            <ErrorNote message={error} />
          </div>
        )}

        <div className={cn("grid gap-2", columns.length === 2 && "grid-cols-2")}>
          {columns.map((col) => {
            const list = dayTasks.filter((t) => t.status === col);
            return (
              <section
                key={col}
                aria-label={`${col} 열`}
                className={cn(
                  "flex min-h-40 min-w-0 flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-100/60",
                  COLUMN_STYLE[col],
                )}
              >
                <header className="flex items-center justify-between px-2.5 py-2">
                  <h2 className="text-sm font-semibold">{col}</h2>
                  <span className="text-xs text-slate-500">{list.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-1.5 px-1.5 pb-1.5">
                  {list.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      busy={busyId === t.id}
                      onToggle={toggle}
                      onOpen={(task) => setModal({ kind: "task", task })}
                    />
                  ))}
                  {!list.length && <Empty>업무가 없습니다.</Empty>}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {/* ---------- 캘린더 ---------- */}
      <CalendarPanel
        tasks={tasks}
        schedules={schedules}
        mode={mode}
        onModeChange={setMode}
        year={ym.y}
        month={ym.m}
        onMove={moveMonth}
        onToday={() => selectDate(today)}
        selected={date}
        onSelect={selectDate}
        onOpenTask={(task) => setModal({ kind: "task", task })}
        onOpenSchedule={(schedule) => setModal({ kind: "schedule", schedule })}
        onAdd={() => setModal({ kind: "schedule", date })}
      />

      {modal?.kind === "task" && (
        <TaskFormModal
          task={modal.task}
          defaultDate={modal.date}
          defaultCategory={category === "전체" ? undefined : category}
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
