"use client";

import { diffDays, shortDate, todayStr } from "@/lib/date";
import type { Task } from "@/lib/types";
import { Badge, CategoryBadge, PriorityBadge, cn } from "./ui";

export function DueBadge({ task }: { task: Task }) {
  if (task.status === "완료" || !task.dueDate) return null;
  const d = diffDays(todayStr(), task.dueDate);
  if (d < 0) return <Badge className="bg-rose-100 text-rose-700">지연 {-d}일</Badge>;
  if (d === 0) return <Badge className="bg-orange-100 text-orange-700">오늘 마감</Badge>;
  if (d <= 2) return <Badge className="bg-amber-100 text-amber-700">임박</Badge>;
  return null;
}

export function CompleteCheckbox({
  task,
  onToggle,
  disabled,
}: {
  task: Task;
  onToggle: (t: Task, done: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
      checked={task.status === "완료"}
      disabled={disabled}
      onChange={(e) => onToggle(task, e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`${task.title} 완료 처리`}
    />
  );
}

/** 칸반 카드 */
export function TaskCard({
  task,
  onToggle,
  onOpen,
  busy,
  draggable,
}: {
  task: Task;
  onToggle: (t: Task, done: boolean) => void;
  onOpen: (t: Task) => void;
  busy?: boolean;
  draggable?: boolean;
}) {
  const done = task.status === "완료";
  return (
    <article
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={() => onOpen(task)}
      className={cn(
        "cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-300",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <CompleteCheckbox task={task} onToggle={onToggle} disabled={busy} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn("text-sm font-medium break-words", done && "text-slate-400 line-through")}>
              {task.title}
            </h3>
            <DueBadge task={task} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <CategoryBadge c={task.category} />
            <PriorityBadge p={task.priority} />
            <span className="ml-auto text-xs text-slate-500">{task.dueDate ? shortDate(task.dueDate) : "마감일 없음"}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
