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

export type ToggleItem = (t: Task, index: number, done: boolean) => void;

/** 체크리스트 진행률 (예: 2/5). 체크리스트가 없으면 아무것도 안 보인다 */
export function ChecklistBadge({ task }: { task: Task }) {
  const total = task.checklist.length;
  if (!total) return null;
  const done = task.checklist.filter((c) => c.done).length;
  return (
    <Badge className={done === total ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
      {done}/{total}
    </Badge>
  );
}

/** 카드·목록에서 바로 체크하는 체크리스트. 누르면 업무 창이 열리지 않고 체크만 바뀐다 */
export function ChecklistChecks({
  task,
  onToggleItem,
  disabled,
}: {
  task: Task;
  onToggleItem: ToggleItem;
  disabled?: boolean;
}) {
  if (!task.checklist.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {task.checklist.map((c, i) => (
        <li key={i}>
          <label
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 transition",
              c.done
                ? "bg-emerald-50 text-emerald-700 line-through ring-emerald-200"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50",
              disabled && "cursor-wait",
            )}
          >
            <input
              type="checkbox"
              className="h-3 w-3 accent-emerald-600"
              checked={c.done}
              disabled={disabled}
              onChange={(e) => onToggleItem(task, i, e.target.checked)}
            />
            {c.text}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** 칸반 카드 */
export function TaskCard({
  task,
  onToggle,
  onToggleItem,
  onOpen,
  busy,
  hideCategory,
}: {
  task: Task;
  onToggle: (t: Task, done: boolean) => void;
  onToggleItem: ToggleItem;
  onOpen: (t: Task) => void;
  busy?: boolean;
  /** 카테고리별 열 안에서는 카테고리 표시를 뺀다 */
  hideCategory?: boolean;
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
            {!hideCategory && <CategoryBadge c={task.category} />}
            <ChecklistBadge task={task} />
            <DueBadge task={task} />
            {task.endDate && <span className="text-[11px] text-slate-500">{rangeLabel(task)}</span>}
          </div>
          <ChecklistChecks task={task} onToggleItem={onToggleItem} disabled={busy} />
        </div>
      </div>
    </article>
  );
}
