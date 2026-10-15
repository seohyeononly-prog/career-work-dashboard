"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { addDays, shortDate, todayStr } from "@/lib/date";
import { useTasks } from "@/lib/use-tasks";
import type { Category, Task } from "@/lib/types";
import { CalendarPanel } from "./CalendarPanel";
import { TaskFormModal } from "./forms";
import { useToast } from "./Toast";

type Modal = { task?: Task; date?: string } | null;

const ymOf = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) });

/** 캘린더 화면: 업무를 달력으로 본다 */
export function CalendarView({ initialTasks }: { initialTasks: Task[] }) {
  const today = todayStr();
  const { tasks, save, remove } = useTasks(initialTasks);
  const [date, setDate] = useState(today);
  const [ym, setYm] = useState(ymOf(today));
  /** 카테고리 필터 (null = 전체) */
  const [category, setCategory] = useState<Category | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const toast = useToast();

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

  /** 캘린더에서 끌어 옮긴 업무: 기간 전체를 n일 민다. 먼저 화면에 반영하고 실패하면 되돌린다. */
  const moveTask = async (t: Task, n: number) => {
    const next = { ...t, startDate: addDays(t.startDate, n), endDate: t.endDate ? addDays(t.endDate, n) : "" };
    save(next);
    try {
      save(await api.updateTask(t.id, { startDate: next.startDate, endDate: next.endDate }));
      toast(`'${t.title}' 날짜를 ${shortDate(next.startDate)}로 바꿨어요`);
    } catch (e) {
      save(t);
      toast((e as Error).message, "error");
    }
  };

  const shownTasks = category ? tasks.filter((t) => t.category === category) : tasks;

  return (
    <>
      <CalendarPanel
        tasks={shownTasks}
        category={category}
        onCategoryChange={setCategory}
        year={ym.y}
        month={ym.m}
        onMove={moveMonth}
        onToday={() => selectDate(today)}
        selected={date}
        onSelect={selectDate}
        onOpenTask={(task) => setModal({ task })}
        onAddTask={(d) => setModal({ date: d })}
        onMoveTask={moveTask}
      />

      {modal && (
        <TaskFormModal
          task={modal.task}
          defaultDate={modal.date}
          defaultCategory={category ?? undefined}
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
    </>
  );
}
