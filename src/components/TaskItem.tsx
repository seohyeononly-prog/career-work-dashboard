"use client";

import { diffDays, rangeLabel, todayStr } from "@/lib/date";
import { rangeEnd, type Task } from "@/lib/types";
import { Badge, CategoryBadge, cn } from "./ui";

/** 미완료 업무의 지연 표시 (기간 업무는 종료일 기준). 대부분 당일 업무라 오늘 마감·임박은 표시하지 않는다 */
export function DueBadge({ task }: { task: Task }) {
  if (task.status === "완료" || !task.startDate) return null;
  const d = diffDays(todayStr(), rangeEnd(task));
  return d < 0 ? <Badge className="bg-rose-100 text-rose-700">지연 {-d}일</Badge> : null;
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
}: {
  task: Task;
  onToggle: (t: Task, done: boolean) => void;
  onOpen: (t: Task) => void;
  busy?: boolean;
}) {
  const done = task.status === "완료";
  return (
    <article
      onClick={() => onOpen(task)}
      className={cn(
        "cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-indigo-300",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <CompleteCheckbox task={task} onToggle={onToggle} disabled={busy} />
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-sm font-medium break-words", done && "text-slate-400 line-through")}>{task.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <CategoryBadge c={task.category} />
            <DueBadge task={task} />
            {task.endDate && <span className="text-[11px] text-slate-500">{rangeLabel(task)}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}
