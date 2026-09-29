"use client";

import { useState } from "react";
import { api, upsert } from "./client-api";
import type { Task, TaskStatus } from "./types";

/** 업무 목록 상태와 상태 변경 처리(낙관적 업데이트, 실패 시 되돌림) */
export function useTasks(initial: Task[]) {
  const [tasks, setTasks] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const changeStatus = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    setError("");
    setBusyId(task.id);
    setTasks((l) => upsert(l, { ...task, status }));
    try {
      const saved = await api.updateTask(task.id, { status });
      setTasks((l) => upsert(l, saved));
    } catch (e) {
      setTasks((l) => upsert(l, task));
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  // 체크하면 완료, 체크 해제하면 미완료(대기)로 되돌린다
  const toggle = (task: Task, done: boolean) => changeStatus(task, done ? "완료" : "대기");

  const save = (t: Task) => setTasks((l) => upsert(l, t));

  /** 드래그로 정한 순서(ids)를 1, 2, 3… 으로 저장한다 */
  const reorder = async (ids: string[]) => {
    setError("");
    const prev = tasks;
    const order = new Map(ids.map((id, i) => [id, i + 1]));
    setTasks((l) => l.map((t) => (order.has(t.id) ? { ...t, order: order.get(t.id)! } : t)));
    try {
      await api.reorderTasks(ids);
    } catch (e) {
      setTasks(prev);
      setError((e as Error).message);
    }
  };

  return { tasks, busyId, error, toggle, changeStatus, save, reorder };
}
