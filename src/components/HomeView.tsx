"use client";

import Link from "next/link";
import { useState } from "react";
import { rangeLabel, shortDate, todayStr } from "@/lib/date";
import { useTasks } from "@/lib/use-tasks";
import { isVirtual } from "@/lib/routines";
import { CATEGORIES, LINK_CATEGORIES, TASK_STATUSES, rangeEnd, type LinkItem, type Routine, type Task } from "@/lib/types";
import { TaskFormModal } from "./forms";
import { ServiceMark } from "./ServiceMark";
import { CompleteCheckbox, DueBadge, MemoLink, RoutineBadge } from "./TaskItem";
import { CATEGORY_STYLE, Card, CategoryBadge, Empty, ErrorNote, PageHeader, cn } from "./ui";

// 마감 기준은 업무의 마지막 날(기간 업무는 종료일)
const byDue = (a: Task, b: Task) => rangeEnd(a).localeCompare(rangeEnd(b));

export function HomeView({
  initialTasks,
  initialRoutines,
  links,
}: {
  initialTasks: Task[];
  initialRoutines: Routine[];
  links: LinkItem[];
}) {
  const { tasks, cardsOn, busyId, error, toggle, save, remove, saveRoutine } = useTasks(
    initialTasks,
    initialRoutines,
  );
  const [editing, setEditing] = useState<Task | null>(null);
  const today = todayStr();

  // 오늘 생기는 루틴(아직 저장 안 한 것)도 오늘 마감 업무에 넣는다
  const dueToday = [...tasks.filter((t) => rangeEnd(t) === today), ...cardsOn(today)]
    .sort((a, b) => Number(a.status === "완료") - Number(b.status === "완료"));
  const open = tasks.filter((t) => t.status !== "완료");
  const overdue = open.filter((t) => t.startDate && rangeEnd(t) < today).sort(byDue);
  const upcoming = open.filter((t) => !t.startDate || rangeEnd(t) > today).sort(byDue);

  const favorites = links.filter((l) => l.favorite);

  const row = (t: Task) => (
    <li key={t.id} className="flex items-start gap-2 py-2">
      <CompleteCheckbox task={t} onToggle={toggle} disabled={busyId === t.id} />
      <div className="min-w-0 flex-1">
        <button onClick={() => setEditing(t)} className="w-full text-left">
          <span className={cn("block text-sm break-words", t.status === "완료" && "text-slate-400 line-through")}>
            {t.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <CategoryBadge c={t.category} />
            {t.routineId && <RoutineBadge />}
            <DueBadge task={t} />
            <span className="text-xs text-slate-500">{rangeLabel(t)}</span>
          </span>
        </button>
        <MemoLink task={t} />
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="홈">
        <span className="text-sm text-slate-500">오늘 {shortDate(today)}</span>
      </PageHeader>
      {error && <div className="mb-3"><ErrorNote message={error} /></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`오늘 마감 업무 (${dueToday.length})`}>
          {dueToday.length ? <ul className="divide-y divide-slate-100">{dueToday.map(row)}</ul> : <Empty>오늘 마감인 업무가 없습니다.</Empty>}
        </Card>

        <Card
          title="미완료 · 지연 업무"
          className="lg:col-span-2"
          action={<Link href="/kanban" className="text-xs text-indigo-600 hover:underline">칸반보드</Link>}
        >
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat label="미완료" value={open.length} />
            <Stat label="지연" value={overdue.length} tone="danger" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-rose-600">지연</p>
              {overdue.length ? <ul className="divide-y divide-slate-100">{overdue.map(row)}</ul> : <Empty>지연된 업무가 없습니다.</Empty>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">다가오는 미완료</p>
              {upcoming.length ? (
                <ul className="divide-y divide-slate-100">{upcoming.slice(0, 6).map(row)}</ul>
              ) : (
                <Empty>남은 업무가 없습니다.</Empty>
              )}
              {upcoming.length > 6 && <p className="pt-1 text-xs text-slate-400">외 {upcoming.length - 6}건</p>}
            </div>
          </div>
        </Card>

        <Card title="카테고리별 진행 상황" className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-3">
            {/* 기타는 해당 업무가 있을 때만 표시 */}
            {CATEGORIES.filter((c) => c !== "기타" || tasks.some((t) => t.category === c)).map((c) => {
              const list = tasks.filter((t) => t.category === c);
              const done = list.filter((t) => t.status === "완료").length;
              const pct = list.length ? Math.round((done / list.length) * 100) : 0;
              return (
                <div key={c}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{c}</span>
                    <span className="text-xs text-slate-500">
                      {done}/{list.length} 완료 · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c} 진행률`}>
                    <div className={cn("h-full rounded-full", CATEGORY_STYLE[c].bar)} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 flex gap-3 text-xs text-slate-500">
                    {TASK_STATUSES.map((s) => (
                      <span key={s}>
                        {s} {list.filter((t) => t.status === s).length}
                      </span>
                    ))}
                    {overdue.some((t) => t.category === c) && (
                      <span className="text-rose-600">지연 {overdue.filter((t) => t.category === c).length}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="자주 보는 링크" className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-3">
            {LINK_CATEGORIES.map((c) => {
              const list = favorites.filter((l) => l.category === c);
              return (
                <div key={c}>
                  <p className="mb-1 text-xs font-semibold text-slate-500">{c}</p>
                  {list.length ? (
                    <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                      {list.map((l) => (
                        <li key={l.id}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                          >
                            <ServiceMark service={l.service} />
                            <span className="min-w-0 truncate">{l.name}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>즐겨찾기한 링크가 없습니다. 사이드바에서 링크를 수정해 즐겨찾기할 수 있어요.</Empty>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {editing && (
        <TaskFormModal
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            save(t, isVirtual(editing) ? editing.id : undefined);
            setEditing(null);
          }}
          onDeleted={(id) => {
            remove(id);
            setEditing(null);
          }}
          onRoutineSaved={saveRoutine}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone, className }: { label: string; value: number; tone?: "danger"; className?: string }) {
  return (
    <div className={cn("rounded-md bg-slate-50 px-3 py-2", className)}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("text-xl font-bold", tone === "danger" && value > 0 ? "text-rose-600" : "text-slate-900")}>{value}</p>
    </div>
  );
}
