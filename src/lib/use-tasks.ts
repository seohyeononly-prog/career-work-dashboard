"use client";

import { useState } from "react";
import { api, upsert } from "./client-api";
import { todayStr } from "./date";
import { isExpiredRoutine, isVirtual, routineCards, taskInputOf } from "./routines";
import { covers, statusOfChecklist, type Routine, type Task, type TaskInput, type TaskStatus } from "./types";

/**
 * 업무 목록 상태와 상태 변경 처리(낙관적 업데이트, 실패 시 되돌림).
 * 루틴을 넘기면 날짜마다 아직 저장하지 않은 루틴을 가상 카드로 끼워 준다.
 * 가상 카드는 체크·끌기·수정할 때 업무로 저장된다.
 */
export function useTasks(initial: Task[], initialRoutines: Routine[] = []) {
  const [all, setTasks] = useState(initial);
  const [routines, setRoutines] = useState(initialRoutines);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const today = todayStr();

  // 지나간 날의 끝내지 못한 루틴 업무는 보이지 않는다
  const tasks = all.filter((t) => !isExpiredRoutine(t, today));
  /** 그날 아직 저장하지 않은 루틴 카드 */
  const cardsOn = (day: string) => routineCards(routines, all, day, today);
  /** 그날의 업무: 저장된 업무 + 루틴 카드 */
  const tasksOn = (day: string) => [...tasks.filter((t) => covers(t, day)), ...cardsOn(day)];

  /** 저장된 업무는 고치고, 가상 카드는 바뀐 값으로 새 업무를 만든다 */
  const persist = (task: Task, patch: Partial<TaskInput>) =>
    isVirtual(task) ? api.createTask({ ...taskInputOf(task), ...patch }) : api.updateTask(task.id, patch);
  /** 저장 결과로 바꿔 넣는다. 가상 카드였으면 가상 ID 자리를 진짜 업무로 */
  const settle = (task: Task, saved: Task) =>
    setTasks((l) => (isVirtual(task) ? [...l.filter((t) => t.id !== task.id), saved] : upsert(l, saved)));
  const rollback = (task: Task) =>
    setTasks((l) => (isVirtual(task) ? l.filter((t) => t.id !== task.id) : upsert(l, task)));

  /** 한 업무의 값을 바꿔 저장한다. 가상 카드는 바로 화면 목록에 넣어 두고 저장되면 바꿔 끼운다 */
  const patchTask = async (task: Task, patch: Partial<TaskInput>) => {
    setError("");
    setBusyId(task.id);
    setTasks((l) => upsert(l, { ...task, ...patch }));
    try {
      settle(task, await persist(task, patch));
    } catch (e) {
      rollback(task);
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = (task: Task, status: TaskStatus) => {
    if (task.status !== status) return patchTask(task, { status });
  };

  // 체크하면 완료, 체크 해제하면 미완료(대기)로 되돌린다
  const toggle = (task: Task, done: boolean) => changeStatus(task, done ? "완료" : "대기");

  /** 체크리스트 한 줄 체크. 다 체크하면 업무도 완료, 하나라도 풀면 다시 대기 */
  const toggleItem = (task: Task, index: number, done: boolean) => {
    const checklist = task.checklist.map((c, i) => (i === index ? { ...c, done } : c));
    return patchTask(task, { checklist, status: statusOfChecklist(checklist) ?? task.status });
  };

  /** 수정 창에서 저장한 업무. 가상 카드를 저장했으면(replaces) 그 카드 자리를 바꾼다 */
  const save = (t: Task, replaces?: string) =>
    setTasks((l) => upsert(replaces ? l.filter((x) => x.id !== replaces) : l, t));
  const remove = (id: string) => setTasks((l) => l.filter((t) => t.id !== id));

  /**
   * 칸반 끌어 놓기. list는 그날 업무를 새 순서대로 늘어놓은 것(옮긴 카드는 바뀐 상태·카테고리 그대로).
   * 옮긴 카드의 상태·카테고리를 저장하고 순서를 1, 2, 3… 으로 매긴다.
   * 가상 카드는 순서가 없어(0) 칸 맨 아래에 붙으므로, 옮긴 카드이거나 같은 칸에서 저장된 카드보다 위에 놓인 것만 업무로 만든다.
   * 시트 한 줄을 통째로 쓰는 업무 저장이 순서 저장을 덮지 않도록 차례로 저장한다.
   */
  const arrange = async (list: Task[], moved: Task, patch: Partial<Pick<Task, "status" | "category">>) => {
    setError("");
    const prev = all;
    const zone = (t: Task) => `${t.category}/${t.status}`;
    const keepsPlace = (t: Task) => !isVirtual(t) || t.id === moved.id;
    const toSave = new Set(
      list
        .filter((t, i) => isVirtual(t) && (t.id === moved.id || list.slice(i + 1).some((u) => zone(u) === zone(t) && keepsPlace(u))))
        .map((t) => t.id),
    );
    const ordered = list.filter((t) => !isVirtual(t) || toSave.has(t.id));
    const order = new Map(ordered.map((t, i) => [t.id, i + 1]));
    const placed = ordered.map((t) => ({ ...t, order: order.get(t.id)! }));
    setBusyId(moved.id);
    setTasks((l) => placed.reduce((acc, t) => upsert(acc, t), l));
    try {
      if (!isVirtual(moved) && Object.keys(patch).length) await api.updateTask(moved.id, patch);
      const ids = new Map<string, string>();
      for (const t of ordered.filter((x) => toSave.has(x.id))) ids.set(t.id, (await api.createTask(taskInputOf(t))).id);
      const realIds = ordered.map((t) => ids.get(t.id) ?? t.id);
      await api.reorderTasks(realIds);
      setTasks((l) => l.map((t) => (ids.has(t.id) ? { ...t, id: ids.get(t.id)! } : t)));
    } catch (e) {
      setTasks(prev);
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const saveRoutine = (r: Routine) => setRoutines((l) => upsert(l, r));
  const removeRoutine = (id: string) => setRoutines((l) => l.filter((r) => r.id !== id));

  return {
    tasks,
    routines,
    tasksOn,
    cardsOn,
    busyId,
    error,
    toggle,
    toggleItem,
    changeStatus,
    save,
    remove,
    arrange,
    saveRoutine,
    removeRoutine,
  };
}
