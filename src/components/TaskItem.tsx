"use client";

import { diffDays, rangeLabel, todayStr } from "@/lib/date";
import { isVirtual } from "@/lib/routines";
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

/** 링크 주소를 짧게: 도메인만 (www. 뺌) */
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** 카드·목록에 보이는 메모(두 줄까지)와 링크. 링크를 누르면 업무 창이 열리지 않고 새 탭으로 연다 */
export function MemoLink({ task }: { task: Task }) {
  const memo = task.memo.trim();
  if (!memo && !task.link) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {memo && <p className="line-clamp-2 text-xs break-words whitespace-pre-line text-slate-500">{memo}</p>}
      {task.link && (
        <a
          href={task.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={task.link}
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-100"
        >
          <span aria-hidden>🔗</span>
          <span className="truncate">{hostOf(task.link)}</span>
        </a>
      )}
    </div>
  );
}

/** 칸반 카드 */
export function TaskCard({
  task,
  onToggle,
  onOpen,
  busy,
  hideCategory,
}: {
  task: Task;
  onToggle: (t: Task, done: boolean) => void;
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
        isVirtual(task) && "border-dashed",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <CompleteCheckbox task={task} onToggle={onToggle} disabled={busy} />
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-sm font-medium break-words", done && "text-slate-400 line-through")}>{task.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {!hideCategory && <CategoryBadge c={task.category} />}
            {task.routineId && <RoutineBadge />}
            <DueBadge task={task} />
            {task.endDate && <span className="text-[11px] text-slate-500">{rangeLabel(task)}</span>}
          </div>
          <MemoLink task={task} />
        </div>
      </div>
    </article>
  );
}

/** 루틴에서 생긴 업무 표시 */
export const RoutineBadge = () => (
  <Badge className="bg-violet-50 text-violet-700">
    <span aria-hidden>↻</span>&nbsp;루틴
  </Badge>
);
