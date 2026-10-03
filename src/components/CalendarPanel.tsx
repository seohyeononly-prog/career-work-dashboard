"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WEEKDAYS, diffDays, monthGrid, rangeLabel, shortDate, toUTCDate, todayStr } from "@/lib/date";
import {
  CATEGORIES,
  SCHEDULE_KEYWORDS,
  companyOf,
  covers,
  rangeEnd,
  withoutCompany,
  type Category,
  type Schedule,
  type Task,
} from "@/lib/types";
import { Button, CATEGORY_STYLE, CategoryBadge, Empty, Select, cn } from "./ui";

/** 업무 확인 / 일정 확인 / 기업별 일정(일경험 일정 중 '[기업]'으로 시작하는 것) */
export type CalendarMode = "task" | "schedule" | "company";

/** 기업 선택값: 기업명, 또는 기업이 붙은 일경험 일정 전체 */
export const ALL_COMPANIES = "";

const MAX_IN_CELL = 3;

const MODES = [
  ["task", "업무 확인"],
  ["schedule", "일정 확인"],
  ["company", "기업별 일정"],
] as const;

/** 탭마다 캘린더 색을 조금씩 다르게: 활성 탭, 추가 버튼, 캘린더 윗선, 요일 줄 */
const MODE_STYLE: Record<CalendarMode, { tab: string; add: string; frame: string; head: string }> = {
  task: {
    tab: "bg-indigo-100 text-indigo-800",
    add: "",
    frame: "border-t-indigo-500",
    head: "bg-indigo-50/70 text-indigo-900/70",
  },
  schedule: {
    tab: "bg-sky-100 text-sky-800",
    add: "bg-sky-600! hover:bg-sky-700!",
    frame: "border-t-sky-500",
    head: "bg-sky-50 text-sky-900/70",
  },
  company: {
    tab: "bg-violet-100 text-violet-800",
    add: "bg-violet-600! hover:bg-violet-700!",
    frame: "border-t-violet-500",
    head: "bg-violet-50 text-violet-900/70",
  },
};

/** 칸 안의 일정 한 줄: 일정 하나, 또는 기업만 다른 같은 일정 묶음 */
type CellEntry =
  | { kind: "one"; item: Schedule }
  | {
      kind: "group";
      key: string;
      title: string;
      category: Schedule["category"];
      items: Schedule[];
    };

/**
 * 묶는 기준: SCHEDULE_KEYWORDS 중 제목에 처음 맞는 단어('md | 종료'와 '2기 종료'는 같이),
 * 없으면 '[기업]'을 뺀 제목 그대로(기업이 붙은 일정만)
 */
const groupOf = (s: Schedule) => {
  const rest = withoutCompany(s.title).trim();
  const flat = rest.replace(/\s/g, "").toLowerCase();
  const kw = SCHEDULE_KEYWORDS.find((k) => flat.includes(k.replace(/\s/g, "").toLowerCase()));
  if (kw) return { key: `${s.category}|#${kw}`, title: kw };
  return companyOf(s.title) ? { key: `${s.category}|${rest}`, title: rest } : null;
};

/** 묶음 목록에서 일정 이름: 기업, 기업이 없으면 제목 */
const groupLabel = (s: Schedule) => companyOf(s.title) || s.title;

/** 같은 단어('종료', '면접' 등)를 가진 일정이나 기업만 다른 같은 일정은 한 줄로 묶는다 */
const groupSchedules = (list: Schedule[]): CellEntry[] => {
  const groups = new Map<string, Schedule[]>();
  for (const s of list) {
    const g = groupOf(s);
    if (g) groups.set(g.key, [...(groups.get(g.key) ?? []), s]);
  }
  const out: CellEntry[] = [];
  const done = new Set<string>();
  for (const s of list) {
    const info = groupOf(s);
    const g = info && groups.get(info.key);
    if (!info || !g || g.length < 2) out.push({ kind: "one", item: s });
    else if (!done.has(info.key)) {
      done.add(info.key);
      const items = [...g].sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), "ko"));
      out.push({
        kind: "group",
        key: info.key,
        title: info.title,
        category: s.category,
        items,
      });
    }
  }
  return out;
};

type DragItem = { kind: "task"; item: Task; from: string } | { kind: "schedule"; item: Schedule; from: string };

/** 일정 캘린더에서 주말도 보여 줄지 (localStorage, 켜면 "1") */
const WEEKEND_KEY = "calendar-show-weekend";
const noSubscribe = () => () => {};
function readShowWeekend() {
  try {
    return localStorage.getItem(WEEKEND_KEY) === "1";
  } catch {
    return false;
  }
}

/** 기업별 보기에서 보여 줄 일정인지 */
export const matchesCompany = (s: Schedule, company: string) =>
  s.category === "일경험" && companyOf(s.title) !== "" && (company === ALL_COMPANIES || companyOf(s.title) === company);

/** 월 캘린더. 날짜 선택·월 이동·필터 상태는 부모(CalendarView)가 가진다. */
export function CalendarPanel({
  tasks,
  schedules,
  mode,
  onModeChange,
  category,
  onCategoryChange,
  company,
  onCompanyChange,
  year,
  month,
  onMove,
  onToday,
  selected,
  onSelect,
  onOpenTask,
  onOpenSchedule,
  onAdd,
  onAddTask,
  onMoveTask,
  onMoveSchedule,
}: {
  tasks: Task[];
  schedules: Schedule[];
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
  /** 카테고리 필터 (null = 전체). 걸러 낸 목록은 부모가 넘겨준다 */
  category: Category | null;
  onCategoryChange: (c: Category | null) => void;
  company: string;
  onCompanyChange: (c: string) => void;
  year: number;
  month: number;
  onMove: (delta: number) => void;
  onToday: () => void;
  selected: string;
  onSelect: (day: string) => void;
  onOpenTask: (t: Task) => void;
  onOpenSchedule: (s: Schedule) => void;
  /** 해당 날짜로 일정 추가 */
  onAdd: (date: string) => void;
  /** 해당 날짜로 업무 추가 */
  onAddTask: (date: string) => void;
  /** 드래그로 날짜 옮기기: 기간 전체를 days만큼 민다 */
  onMoveTask: (t: Task, days: number) => void;
  onMoveSchedule: (s: Schedule, days: number) => void;
}) {
  const today = todayStr();
  /** '더보기'로 모든 항목을 펼친 날짜 */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  /** 열어 둔 기업 묶음: 누른 버튼 아래에 기업 목록을 띄운다 */
  const [groupPop, setGroupPop] = useState<{
    items: Schedule[];
    title: string;
    top: number;
    left: number;
  } | null>(null);
  const groupPopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!groupPop) return;
    const close = () => setGroupPop(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    // 팝업 안 기업 목록을 스크롤할 때는 닫지 않는다
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && groupPopRef.current?.contains(e.target)) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [groupPop]);
  // 일정 캘린더(일정 확인·기업별)의 주말 보기는 이 브라우저에 기억한다 (누르기 전에는 저장된 값)
  const savedWeekend = useSyncExternalStore(noSubscribe, readShowWeekend, () => false);
  const [editedWeekend, setEditedWeekend] = useState<boolean | null>(null);
  const showWeekend = editedWeekend ?? savedWeekend;
  const toggleWeekend = () => {
    const next = !showWeekend;
    setEditedWeekend(next);
    try {
      localStorage.setItem(WEEKEND_KEY, next ? "1" : "");
    } catch {}
  };

  const days = monthGrid(year, month);
  // 업무 확인은 늘 주말까지, 일정 캘린더는 '주말' 버튼을 켰을 때만 주말을 보여 준다
  const weekdaysOnly = mode !== "task" && !showWeekend;
  const cols = weekdaysOnly ? 5 : 7;
  const gridCls = weekdaysOnly ? "grid grid-cols-5" : "grid grid-cols-7";
  const cells = weekdaysOnly ? days.filter((d) => ![0, 6].includes(toUTCDate(d).getUTCDay())) : days;
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  // 기업 목록: 일경험 일정 제목의 '[기업]'. 고른 기업의 일정을 다 지워도 선택은 유지되게 넣어 둔다.
  const companies = [
    ...new Set([
      ...schedules.filter((s) => s.category === "일경험").map((s) => companyOf(s.title)),
      company,
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ko"));

  const visibleSchedules = mode === "company" ? schedules.filter((s) => matchesCompany(s, company)) : schedules;
  const tasksOn = (d: string) =>
    tasks.filter((t) => covers(t, d)).sort((a, b) => Number(a.status === "완료") - Number(b.status === "완료"));
  const schedulesOn = (d: string) =>
    visibleSchedules.filter((s) => covers(s, d)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  /** 기업을 하나 골랐으면 제목의 '[기업]'은 빼고 보여 준다 */
  const scheduleTitle = (s: Schedule) => (mode === "company" && company ? withoutCompany(s.title) || s.title : s.title);

  const dropOn = (d: string) => {
    const moving = drag;
    setDrag(null);
    setOverDay(null);
    if (!moving) return;
    const delta = diffDays(moving.from, d);
    if (!delta) return;
    if (moving.kind === "task") onMoveTask(moving.item, delta);
    else onMoveSchedule(moving.item, delta);
  };
  const dragProps = (it: DragItem) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      setDrag(it);
    },
    onDragEnd: () => {
      setDrag(null);
      setOverDay(null);
    },
  });

  /** 일정 캘린더: 기업만 다른 같은 일정은 한 줄로 (기업을 하나 골랐으면 묶지 않는다) */
  const entriesOf = (list: Schedule[]): CellEntry[] =>
    mode === "company" && company ? list.map((item) => ({ kind: "one", item })) : groupSchedules(list);

  const selectedSchedules = schedulesOn(selected);
  const selectedEntries = entriesOf(selectedSchedules);

  return (
    <section aria-label="캘린더" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold">캘린더</h2>
        {mode === "task" ? (
          <Button variant="primary" onClick={() => onAddTask(selected)}>
            + 새 업무
          </Button>
        ) : (
          <Button variant="primary" className={MODE_STYLE[mode].add} onClick={() => onAdd(selected)}>
            + 새 일정
          </Button>
        )}
        <div role="tablist" aria-label="캘린더 보기" className="flex rounded-md border border-slate-200 bg-white p-0.5">
          {MODES.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={mode === k}
              onClick={() => onModeChange(k)}
              className={cn(
                "rounded px-3 py-1 text-sm",
                mode === k ? cn("font-medium", MODE_STYLE[k].tab) : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "company" && (
        <div className="mb-3 flex items-center gap-2">
          <Select
            ariaLabel="기업 선택"
            className="w-auto min-w-40"
            value={company}
            options={[
              { value: ALL_COMPANIES, label: "기업 전체" },
              ...companies.map((c) => ({ value: c, label: c })),
            ]}
            onChange={onCompanyChange}
          />
          <p className="text-xs text-slate-500">
            일경험 일정 중 제목이 <b className="font-medium">[기업명]</b>으로 시작하는 일정이에요.
          </p>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <Button className="px-2" onClick={() => onMove(-1)} aria-label="이전 달">
          ‹
        </Button>
        <span className="min-w-24 text-center text-sm font-semibold">
          {year}년 {month}월
        </span>
        <Button className="px-2" onClick={() => onMove(1)} aria-label="다음 달">
          ›
        </Button>
        <Button variant="ghost" onClick={onToday}>
          오늘
        </Button>
        {mode !== "task" && (
          <button
            type="button"
            aria-pressed={showWeekend}
            onClick={toggleWeekend}
            title={showWeekend ? "주말 숨기기" : "주말 보기"}
            className={cn(
              "rounded border px-1.5 py-0.5 text-xs",
              showWeekend
                ? "border-slate-300 bg-slate-100 text-slate-700"
                : "border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600",
            )}
          >
            주말 {showWeekend ? "숨기기" : "보기"}
          </button>
        )}
        {mode === "company" ? (
          <span className="ml-auto hidden items-center gap-3 text-xs text-slate-500 sm:flex">
            <Legend />
          </span>
        ) : (
          <CategoryFilter value={category} onChange={onCategoryChange} />
        )}
      </div>

      <div className={cn("overflow-hidden rounded-lg border border-t-4 border-slate-200 bg-white", MODE_STYLE[mode].frame)}>
        <div className={cn(gridCls, "border-b border-slate-200 text-center text-xs", MODE_STYLE[mode].head)}>
          {WEEKDAYS.map((w, i) =>
            weekdaysOnly && (i === 0 || i === 6) ? null : (
              <div key={w} className={cn("py-1.5", i === 0 && "text-rose-500", i === 6 && "text-blue-500")}>
                {w}
              </div>
            ),
          )}
        </div>
        <div className={gridCls}>
          {cells.map((d, i) => {
            const inMonth = d.startsWith(monthPrefix);
            const items = mode === "task" ? tasksOn(d) : schedulesOn(d);
            const entries = mode === "task" ? [] : entriesOf(items as Schedule[]);
            const lines = mode === "task" ? items.length : entries.length;
            const open = expanded === d;
            const shown = open ? lines : MAX_IN_CELL;
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                aria-label={`${shortDate(d)} 항목 ${items.length}개`}
                aria-pressed={selected === d}
                onClick={() => onSelect(d)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(d)}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  if (overDay !== d) setOverDay(d);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(d);
                }}
                className={cn(
                  "group/cell min-h-16 min-w-0 cursor-pointer border-slate-100 p-1 text-left sm:min-h-28 sm:p-1.5",
                  i % cols !== cols - 1 && "border-r",
                  i < cells.length - cols && "border-b",
                  !inMonth && "bg-slate-50/70",
                  selected === d && "bg-indigo-50/60 ring-1 ring-indigo-300 ring-inset",
                  drag && overDay === d && "bg-indigo-100/70 ring-2 ring-indigo-400 ring-inset",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      d === today ? "bg-indigo-600 font-bold text-white" : inMonth ? "text-slate-700" : "text-slate-300",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {/* 이 날짜에 바로 추가: 업무 확인이면 업무, 일정 캘린더면 일정 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(d);
                      if (mode === "task") onAddTask(d);
                      else onAdd(d);
                    }}
                    aria-label={`${shortDate(d)}에 ${mode === "task" ? "업무" : "일정"} 추가`}
                    title={`이 날 ${mode === "task" ? "업무" : "일정"} 추가`}
                    className={cn(
                      "hidden h-5 w-5 items-center justify-center rounded text-sm leading-none text-slate-400 hover:bg-indigo-100 hover:text-indigo-700 sm:flex",
                      selected === d ? "opacity-100" : "opacity-0 group-hover/cell:opacity-100 focus:opacity-100",
                    )}
                  >
                    +
                  </button>
                </div>

                {/* 좁은 화면: 개수만 점으로 표시 */}
                {items.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                    {items.slice(0, 4).map((it) => (
                      <span
                        key={it.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          "status" in it && it.status === "완료" ? "bg-slate-300" : CATEGORY_STYLE[it.category].dot,
                        )}
                      />
                    ))}
                  </div>
                )}

                {/* 넓은 화면: 항목 제목 표시. 끌어서 다른 날짜에 놓으면 날짜가 바뀐다 */}
                <ul className="mt-1 hidden space-y-0.5 sm:block">
                  {mode === "task"
                    ? (items as Task[]).slice(0, shown).map((t) => (
                        <li key={t.id}>
                          <button
                            {...dragProps({ kind: "task", item: t, from: d })}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTask(t);
                            }}
                            className={cn(
                              "flex w-full cursor-grab items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-slate-100 active:cursor-grabbing",
                              drag?.item.id === t.id && "opacity-40",
                              t.status === "완료"
                                ? "text-slate-400 line-through"
                                : rangeEnd(t) < today
                                  ? "text-rose-600"
                                  : "text-slate-700",
                            )}
                          >
                            {t.status === "완료" ? (
                              <span className="text-green-600" aria-label="완료">
                                ✓
                              </span>
                            ) : (
                              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", CATEGORY_STYLE[t.category].dot)} />
                            )}
                            <span className="truncate">{t.title}</span>
                          </button>
                        </li>
                      ))
                    : entries.slice(0, shown).map((en) => {
                        if (en.kind === "group")
                          return (
                            <li key={en.key}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelect(d);
                                  const r = e.currentTarget.getBoundingClientRect();
                                  setGroupPop({
                                    items: en.items,
                                    title: en.title,
                                    top: r.bottom + 4,
                                    left: Math.max(8, Math.min(r.left, window.innerWidth - 248)),
                                  });
                                }}
                                aria-haspopup="dialog"
                                title={en.items.map(groupLabel).join(", ")}
                                className={cn(
                                  "flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:opacity-80",
                                  CATEGORY_STYLE[en.category].badge,
                                )}
                              >
                                <span className="truncate">{en.title}</span>
                                <span className="ml-auto shrink-0 rounded-full bg-white/70 px-1 text-[10px] font-semibold">
                                  +{en.items.length}개
                                </span>
                              </button>
                            </li>
                          );
                        const s = en.item;
                        return (
                          <li key={s.id}>
                            <button
                              {...dragProps({
                                kind: "schedule",
                                item: s,
                                from: d,
                              })}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenSchedule(s);
                              }}
                              className={cn(
                                "flex w-full cursor-grab items-center truncate rounded px-1 py-0.5 text-left text-[11px] hover:opacity-80 active:cursor-grabbing",
                                drag?.item.id === s.id && "opacity-40",
                                CATEGORY_STYLE[s.category].badge,
                              )}
                            >
                              <span className="truncate">{scheduleTitle(s)}</span>
                            </button>
                          </li>
                        );
                      })}
                  {lines > MAX_IN_CELL && (
                    <li>
                      {/* 날짜 선택도 같이 되도록 클릭은 칸까지 전달한다 */}
                      <button
                        onClick={() => setExpanded(open ? null : d)}
                        aria-expanded={open}
                        className="w-full rounded px-1 py-0.5 text-left text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      >
                        {open ? "접기" : `+${lines - MAX_IN_CELL}개 더보기`}
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* 기업만 다른 일정 묶음의 기업 목록. 기업을 누르면 그 일정을 연다 */}
      {groupPop && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setGroupPop(null)} aria-hidden />
          <div
            ref={groupPopRef}
            role="dialog"
            aria-label={`${groupPop.title} 기업 목록`}
            style={{ top: groupPop.top, left: groupPop.left }}
            className="fixed z-50 max-h-72 w-60 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            <p className="truncate border-b border-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
              {groupPop.title} <span className="font-normal text-slate-500">{groupPop.items.length}개</span>
            </p>
            <ul>
              {groupPop.items.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setGroupPop(null);
                      onOpenSchedule(s);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  >
                    {/* 묶인 일정끼리 제목이 다를 수 있어 기업 옆에 나머지 제목도 보여 준다 */}
                    <span className="min-w-0 flex-1 truncate">
                      {groupLabel(s)}
                      {companyOf(s.title) && (
                        <span className="ml-1.5 text-xs text-slate-500">{withoutCompany(s.title)}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{rangeLabel(s)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* 선택한 날짜: 업무·일정 추가, 일정 캘린더에서는 그날 일정 목록까지 */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white">
        <div className={cn("flex flex-wrap items-center gap-2 px-3 py-2", mode !== "task" && "border-b border-slate-100")}>
          <h3 className="mr-auto text-sm font-semibold">
            {shortDate(selected)}
            {mode !== "task" && (
              <>
                {" "}
                일정 <span className="font-normal text-slate-500">{selectedSchedules.length}</span>
              </>
            )}
          </h3>
          <Button className="text-xs" onClick={() => onAddTask(selected)}>
            + 이 날 업무 추가
          </Button>
          <Button className="text-xs" onClick={() => onAdd(selected)}>
            + 이 날 일정 추가
          </Button>
        </div>
        {mode !== "task" &&
          (selectedSchedules.length ? (
            <ul className="divide-y divide-slate-100">
              {selectedEntries.map((en) =>
                en.kind === "one" ? (
                  <li key={en.item.id}>
                    <button
                      onClick={() => onOpenSchedule(en.item)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <CategoryBadge c={en.item.category} />
                      <span className="min-w-0 flex-1 truncate text-sm">{en.item.title}</span>
                      <span className="shrink-0 text-xs text-slate-500">{rangeLabel(en.item)}</span>
                    </button>
                  </li>
                ) : (
                  // 캘린더 칩과 같은 묶음: 제목 한 줄 아래에 기업별 일정
                  <li key={en.key} className="py-1.5">
                    <div className="flex items-center gap-2 px-3 py-1">
                      <CategoryBadge c={en.category} />
                      <span
                        className={cn("rounded px-1.5 py-0.5 text-sm font-semibold", CATEGORY_STYLE[en.category].badge)}
                      >
                        {en.title}
                      </span>
                      <span className="text-xs text-slate-500">{en.items.length}개</span>
                    </div>
                    <ul>
                      {en.items.map((s) => (
                        <li key={s.id}>
                          <button
                            onClick={() => onOpenSchedule(s)}
                            className="flex w-full items-center gap-2 py-1.5 pr-3 pl-8 text-left hover:bg-slate-50"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {groupLabel(s)}
                              {companyOf(s.title) && (
                                <span className="ml-1.5 text-xs text-slate-500">{withoutCompany(s.title)}</span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">{rangeLabel(s)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <div className="p-4">
              <Empty>이 날짜에 일정이 없습니다.</Empty>
            </div>
          ))}
      </div>
    </section>
  );
}

/** 카테고리 필터: 전체 또는 하나. 고른 것을 다시 누르면 전체로 */
function CategoryFilter({ value, onChange }: { value: Category | null; onChange: (c: Category | null) => void }) {
  const btn = (on: boolean) =>
    cn(
      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
      on ? "border-slate-300 bg-slate-100 font-medium text-slate-800" : "border-transparent text-slate-500 hover:bg-slate-50",
    );
  return (
    <div role="group" aria-label="카테고리 필터" className="ml-auto flex flex-wrap items-center gap-1">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={btn(value === null)}>
        전체
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value === c}
          onClick={() => onChange(value === c ? null : c)}
          className={btn(value === c)}
        >
          <span className={cn("h-2 w-2 rounded-full", CATEGORY_STYLE[c].dot)} /> {c}
        </button>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <>
      {CATEGORIES.map((c) => (
        <span key={c} className="flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full", CATEGORY_STYLE[c].dot)} /> {c}
        </span>
      ))}
    </>
  );
}
