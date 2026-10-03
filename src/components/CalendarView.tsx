"use client";

import { useState } from "react";
import { api, upsert } from "@/lib/client-api";
import { addDays, shortDate, todayStr } from "@/lib/date";
import { useTasks } from "@/lib/use-tasks";
import { companyNames, scheduleTitles, type Category, type Schedule, type Task } from "@/lib/types";
import { ALL_COMPANIES, CalendarPanel, type CalendarMode } from "./CalendarPanel";
import { ScheduleFormModal, TaskFormModal } from "./forms";
import { useToast } from "./Toast";

type Modal =
  | { kind: "task"; task?: Task; date?: string }
  | { kind: "schedule"; schedule?: Schedule; date?: string; title?: string; category?: Category }
  | null;

const ymOf = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) });

/** 캘린더 화면: 업무 확인 / 일정 확인 / 기업별 일정 */
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
  const { tasks, save, remove } = useTasks(initialTasks);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [date, setDate] = useState(today);
  const [ym, setYm] = useState(ymOf(today));
  const [mode, setModeState] = useState<CalendarMode>(initialMode);
  /** 카테고리 필터 (null = 전체). 기업별 일정은 일경험만 보므로 쓰지 않는다 */
  const [category, setCategory] = useState<Category | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const toast = useToast();
  /** 기업별 일정 보기에서 고른 기업 ("" = 기업 전체) */
  const [company, setCompany] = useState(ALL_COMPANIES);

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

  /** 캘린더에서 끌어 옮긴 업무·일정: 기간 전체를 n일 민다. 먼저 화면에 반영하고 실패하면 되돌린다. */
  const shifted = <T extends Task | Schedule>(r: T, n: number): T => ({
    ...r,
    startDate: addDays(r.startDate, n),
    endDate: r.endDate ? addDays(r.endDate, n) : "",
  });
  const moveTask = async (t: Task, n: number) => {
    const next = shifted(t, n);
    save(next);
    try {
      save(await api.updateTask(t.id, { startDate: next.startDate, endDate: next.endDate }));
      toast(`'${t.title}' 날짜를 ${shortDate(next.startDate)}로 바꿨어요`);
    } catch (e) {
      save(t);
      toast((e as Error).message, "error");
    }
  };
  const moveSchedule = async (s: Schedule, n: number) => {
    const next = shifted(s, n);
    setSchedules((l) => upsert(l, next));
    try {
      const saved = await api.updateSchedule(s.id, { startDate: next.startDate, endDate: next.endDate });
      setSchedules((l) => upsert(l, saved));
      toast(`'${s.title}' 날짜를 ${shortDate(next.startDate)}로 바꿨어요`);
    } catch (e) {
      setSchedules((l) => upsert(l, s));
      toast((e as Error).message, "error");
    }
  };

  /** 일정 추가: 기업별 보기에서는 일경험 + '[기업] '을 미리 채운다. 카테고리 필터를 골라 두었으면 그 카테고리로 */
  const addSchedule = (d: string) =>
    setModal(
      mode === "company"
        ? { kind: "schedule", date: d, category: "일경험", title: company ? `[${company}] ` : "" }
        : { kind: "schedule", date: d, category: category ?? undefined },
    );

  const filtering = mode !== "company" && category !== null;
  const shownTasks = filtering ? tasks.filter((t) => t.category === category) : tasks;
  const shownSchedules = filtering ? schedules.filter((s) => s.category === category) : schedules;

  return (
    <>
      <CalendarPanel
        tasks={shownTasks}
        schedules={shownSchedules}
        mode={mode}
        onModeChange={setMode}
        category={category}
        onCategoryChange={setCategory}
        company={company}
        onCompanyChange={setCompany}
        year={ym.y}
        month={ym.m}
        onMove={moveMonth}
        onToday={() => selectDate(today)}
        selected={date}
        onSelect={selectDate}
        onOpenTask={(task) => setModal({ kind: "task", task })}
        onOpenSchedule={(schedule) => setModal({ kind: "schedule", schedule })}
        onAdd={addSchedule}
        onAddTask={(d) => setModal({ kind: "task", date: d })}
        onMoveTask={moveTask}
        onMoveSchedule={moveSchedule}
      />

      {modal?.kind === "task" && (
        <TaskFormModal
          task={modal.task}
          defaultDate={modal.date}
          defaultCategory={category ?? undefined}
          companies={companyNames(schedules)}
          onClose={() => setModal(null)}
          onSaved={(t) => {
            save(t);
            setModal(null);
          }}
          onDeleted={(id) => {
            remove(id);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "schedule" && (
        <ScheduleFormModal
          schedule={modal.schedule}
          defaultDate={modal.date}
          defaultTitle={modal.title}
          defaultCategory={modal.category}
          companies={companyNames(schedules)}
          titles={scheduleTitles(schedules)}
          onClose={() => setModal(null)}
          onSaved={(s) => {
            setSchedules((l) => upsert(l, s));
            setModal(null);
          }}
          onDeleted={(id) => {
            setSchedules((l) => l.filter((s) => s.id !== id));
            setModal(null);
          }}
        />
      )}
    </>
  );
}
