"use client";

import { useState } from "react";
import { useTasks } from "@/lib/use-tasks";
import { CATEGORIES, TASK_STATUSES, type Category, type Task, type TaskStatus } from "@/lib/types";
import { TaskFormModal } from "./forms";
import { TaskCard } from "./TaskItem";
import { Button, Empty, ErrorNote, PageHeader, Select, cn } from "./ui";

type All = "전체";

const COLUMN_STYLE: Record<TaskStatus, string> = {
  대기: "border-t-slate-400",
  "진행 중": "border-t-sky-500",
  완료: "border-t-green-500",
};

export function KanbanView({ initialTasks }: { initialTasks: Task[] }) {
  const { tasks, busyId, error, toggle, changeStatus, save } = useTasks(initialTasks);
  const [category, setCategory] = useState<Category | All>("전체");
  const [status, setStatus] = useState<TaskStatus | All>("전체");
  const [modal, setModal] = useState<{ task?: Task; status?: TaskStatus } | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const visible = tasks
    .filter((t) => category === "전체" || t.category === category)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const columns = status === "전체" ? TASK_STATUSES : [status];

  const onDrop = (col: TaskStatus, id: string) => {
    setDragOver(null);
    const t = tasks.find((x) => x.id === id);
    if (t) changeStatus(t, col);
  };

  return (
    <div>
      <PageHeader title="칸반보드">
        <Select
          ariaLabel="카테고리 필터"
          className="w-auto"
          value={category}
          options={[{ value: "전체", label: "카테고리 전체" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          onChange={setCategory}
        />
        <Select
          ariaLabel="상태 필터"
          className="w-auto"
          value={status}
          options={[{ value: "전체", label: "상태 전체" }, ...TASK_STATUSES.map((s) => ({ value: s, label: s }))]}
          onChange={setStatus}
        />
        <Button variant="primary" onClick={() => setModal({})}>
          + 새 업무
        </Button>
      </PageHeader>
      {error && <div className="mb-3"><ErrorNote message={error} /></div>}

      <div className={cn("grid gap-4", columns.length === 3 ? "md:grid-cols-3" : "max-w-xl")}>
        {columns.map((col) => {
          const list = visible.filter((t) => t.status === col);
          return (
            <section
              key={col}
              aria-label={`${col} 열`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(col, e.dataTransfer.getData("text/plain"))}
              className={cn(
                "flex min-h-40 flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-100/60",
                COLUMN_STYLE[col],
                dragOver === col && "ring-2 ring-indigo-300",
              )}
            >
              <header className="flex items-center justify-between px-3 py-2">
                <h2 className="text-sm font-semibold">{col}</h2>
                <span className="text-xs text-slate-500">{list.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {list.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    busy={busyId === t.id}
                    draggable
                    onToggle={toggle}
                    onOpen={(task) => setModal({ task })}
                  />
                ))}
                {!list.length && <Empty>업무가 없습니다.</Empty>}
                {col !== "완료" && (
                  <button
                    onClick={() => setModal({ status: col })}
                    className="rounded-md py-1.5 text-left text-xs text-slate-500 hover:bg-white hover:text-slate-700"
                  >
                    + 업무 추가
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {modal && (
        <TaskFormModal
          task={modal.task}
          defaults={{ status: modal.status, category: category === "전체" ? undefined : category }}
          onClose={() => setModal(null)}
          onSaved={(t) => {
            save(t);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
