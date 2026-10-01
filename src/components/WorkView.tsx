"use client";

import { useState, useSyncExternalStore } from "react";
import { api, upsert } from "@/lib/client-api";
import { addDays, fullDate, shortDate, todayStr } from "@/lib/date";
import { useTasks } from "@/lib/use-tasks";
import { CATEGORIES, TASK_STATUSES, byOrder, companyNames, covers, scheduleTitles, type Category, type Schedule, type Task, type TaskStatus } from "@/lib/types";
import { ALL_COMPANIES, CalendarPanel, type CalendarMode } from "./CalendarPanel";
import { ScheduleFormModal, TaskFormModal } from "./forms";
import { TaskCard } from "./TaskItem";
import { useToast } from "./Toast";
import { Button, Empty, ErrorNote, Select, cn, inputCls } from "./ui";

type All = "전체";

type Modal =
  | { kind: "task"; task?: Task; date?: string }
  | { kind: "schedule"; schedule?: Schedule; date?: string; title?: string; category?: Category }
  | null;

const COLUMN_STYLE: Record<TaskStatus, string> = {
  대기: "border-t-slate-400",
  완료: "border-t-green-500",
};

const ymOf = (d: string) => ({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) });

const WBS_URL =
  "https://docs.google.com/spreadsheets/d/1rzAz-WZI-wsCtXZ_CDMRQjKe3mwi58HTDuvw7MqQ8dY/edit?gid=1496926969#gid=1496926969&range=";
const WBS_DEFAULT_CELL = "A60";
const WBS_CELL_KEY = "wbs-cell";
const isCell = (v: string) => /^[A-Z]{1,3}\d{1,6}$/.test(v);
const noSubscribe = () => () => {};

/** 클립보드 API가 막힌 환경(http 접속, 일부 웹뷰)에서는 예전 방식으로 복사한다 */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {}
  const el = document.createElement("textarea");
  el.value = text;
  el.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand("copy");
  el.remove();
  if (!ok) throw new Error("copy failed");
}
function readWbsCell() {
  try {
    const saved = localStorage.getItem(WBS_CELL_KEY);
    if (saved && isCell(saved)) return saved;
  } catch {}
  return WBS_DEFAULT_CELL;
}

/** 복사 버튼 형식: 마감보고는 본부명을 앞에 붙이고, 기타 카테고리는 카테고리명을 뺀다 */
const COPY_FORMATS = {
  report: {
    label: "마감보고 복사",
    line: (t: Task) => `[교육사업본부] ${t.category === "기타" ? "" : `${t.category} `}${t.title}`,
  },
  wbs: { label: "WBS 복사", line: (t: Task) => `${t.category} ${t.title}` },
} as const;
type CopyKind = keyof typeof COPY_FORMATS;

/** 칸반보드(왼쪽) + 캘린더(오른쪽) 한 화면 */
export function WorkView({
  initialTasks,
  initialSchedules,
  initialMode,
}: {
  initialTasks: Task[];
  initialSchedules: Schedule[];
  initialMode: CalendarMode;
}) {
  const today = todayStr();
  const { tasks, busyId, error, toggle, toggleItem, save, remove, reorder } = useTasks(initialTasks);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [date, setDate] = useState(today);
  const [ym, setYm] = useState(ymOf(today));
  const [mode, setModeState] = useState<CalendarMode>(initialMode);
  const [category, setCategory] = useState<Category | All>("전체");
  const [status, setStatus] = useState<TaskStatus | All>("전체");
  const [modal, setModal] = useState<Modal>(null);
  const toast = useToast();
  const [drag, setDrag] = useState<{ id: string; over?: { id: string; after: boolean } } | null>(null);
  /** 기업별 일정 보기에서 고른 기업 ("" = 기업 전체) */
  const [company, setCompany] = useState(ALL_COMPANIES);

  // WBS 셀 위치는 이 브라우저에 기억해 둔다 (입력 전에는 저장된 값을 보여 줌)
  const savedWbsCell = useSyncExternalStore(noSubscribe, readWbsCell, () => WBS_DEFAULT_CELL);
  const [editedWbsCell, setWbsCell] = useState<string | null>(null);
  const wbsCell = editedWbsCell ?? savedWbsCell;
  const changeWbsCell = (v: string) => {
    const cell = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setWbsCell(cell);
    try {
      if (isCell(cell)) localStorage.setItem(WBS_CELL_KEY, cell);
    } catch {}
  };

  /** 날짜를 고르면 칸반보드가 바뀌고, 캘린더도 그 달로 이동한다 */
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
  const setMode = (m: CalendarMode) => {
    setModeState(m);
    const url = new URL(window.location.href);
    url.searchParams.set("view", m);
    window.history.replaceState(null, "", url);
  };

  /** 캘린더에서 끌어 옮긴 업무·일정: 기간 전체를 n일 민다. 먼저 화면에 반영하고 실패하면 되돌린다. */
  const shifted = <T extends Task | Schedule>(r: T, n: number): T => ({
    ...r,
    startDate: addDays(r.startDate, n),
    endDate: r.endDate ? addDays(r.endDate, n) : "",
  });
  const moveTask = async (t: Task, n: number) => {
    const next = shifted(t, n);
    save(next);
    try {
      save(await api.updateTask(t.id, { startDate: next.startDate, endDate: next.endDate }));
      toast(`'${t.title}' 날짜를 ${shortDate(next.startDate)}로 바꿨어요`);
    } catch (e) {
      save(t);
      toast((e as Error).message, "error");
    }
  };
  const moveSchedule = async (s: Schedule, n: number) => {
    const next = shifted(s, n);
    setSchedules((l) => upsert(l, next));
    try {
      const saved = await api.updateSchedule(s.id, { startDate: next.startDate, endDate: next.endDate });
      setSchedules((l) => upsert(l, saved));
      toast(`'${s.title}' 날짜를 ${shortDate(next.startDate)}로 바꿨어요`);
    } catch (e) {
      setSchedules((l) => upsert(l, s));
      toast((e as Error).message, "error");
    }
  };

  /** 일정 추가: 기업별 보기에서는 일경험 + '[기업] '을 미리 채운다 */
  const addSchedule = (d: string) =>
    setModal(
      mode === "company"
        ? { kind: "schedule", date: d, category: "일경험", title: company ? `[${company}] ` : "" }
        : { kind: "schedule", date: d },
    );

  /** 선택한 날짜의 업무 전체(필터 무관). 드래그 순서와 복사 순서의 기준 */
  const allDayTasks = tasks.filter((t) => covers(t, date)).sort(byOrder);
  const dayTasks = allDayTasks.filter((t) => category === "전체" || t.category === category);
  const columns = status === "전체" ? TASK_STATUSES : [status];

  /** 끌던 카드를 같은 열의 대상 카드 앞/뒤로 옮기고, 그날 업무 전체에 순서를 다시 매긴다 */
  const dropOn = (target: Task, after: boolean) => {
    const moving = allDayTasks.find((t) => t.id === drag?.id);
    setDrag(null);
    if (!moving || moving.id === target.id || moving.status !== target.status) return;
    const rest = allDayTasks.filter((t) => t.id !== moving.id);
    const at = rest.findIndex((t) => t.id === target.id) + (after ? 1 : 0);
    const next = [...rest.slice(0, at), moving, ...rest.slice(at)];
    if (next.every((t, i) => t.id === allDayTasks[i].id && t.order === i + 1)) return;
    reorder(next.map((t) => t.id));
  };

  /** 선택한 날짜의 업무 전체를 칸반 순서대로 한 줄씩 복사한다 */
  const copyTasks = async (kind: CopyKind) => {
    const lines = allDayTasks.map(COPY_FORMATS[kind].line);
    const name = COPY_FORMATS[kind].label.replace(" 복사", "");
    if (!lines.length) toast("이 날짜에 복사할 업무가 없어요", "error");
    else {
      try {
        await copyText(lines.join("\n"));
        toast(`${name} ${lines.length}건을 복사했어요`);
      } catch {
        toast("복사하지 못했어요. 다시 시도해 주세요", "error");
      }
    }
    // 새 탭을 먼저 열면 문서 포커스를 잃어 클립보드 쓰기가 실패하므로 복사 후에 연다
    if (kind === "wbs")
      window.open(WBS_URL + (isCell(wbsCell) ? wbsCell : WBS_DEFAULT_CELL), "_blank", "noopener");
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
      {/* ---------- 칸반보드 ---------- */}
      <section aria-label="칸반보드" className="min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <h1 className="mr-auto text-base font-semibold">칸반보드</h1>
          <Button variant="primary" onClick={() => setModal({ kind: "task", date })}>
            + 새 업무
          </Button>
        </div>

        <div className="mb-2 flex items-center gap-1.5">
          <Button className="px-2" onClick={() => selectDate(addDays(date, -1))} aria-label="전날">
            ‹
          </Button>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">날짜 선택</span>
            <input
              type="date"
              value={date}
              onChange={(e) => selectDate(e.target.value)}
              className={cn(inputCls, "text-center font-semibold text-transparent")}
            />
            {/* 요일까지 보이도록 날짜 입력 위에 표시 */}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center pr-6 text-sm font-semibold">
              {fullDate(date)}
            </span>
          </label>
          <Button className="px-2" onClick={() => selectDate(addDays(date, 1))} aria-label="다음 날">
            ›
          </Button>
          <Button variant="ghost" onClick={() => selectDate(today)} disabled={date === today}>
            오늘
          </Button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <Select
            ariaLabel="카테고리 필터"
            value={category}
            options={[{ value: "전체", label: "카테고리 전체" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
            onChange={setCategory}
          />
          <Select
            ariaLabel="상태 필터"
            value={status}
            options={[{ value: "전체", label: "상태 전체" }, ...TASK_STATUSES.map((s) => ({ value: s, label: s }))]}
            onChange={setStatus}
          />
        </div>
        <div className="mb-3 grid grid-cols-[1fr_1fr_4.5rem] gap-1.5">
          {(Object.keys(COPY_FORMATS) as CopyKind[]).map((k) => (
            <Button key={k} onClick={() => copyTasks(k)}>
              {COPY_FORMATS[k].label}
            </Button>
          ))}
          <input
            value={wbsCell}
            onChange={(e) => changeWbsCell(e.target.value)}
            aria-label="WBS 복사 시 열 셀 위치"
            title="WBS 복사 시 열 셀 위치"
            placeholder={WBS_DEFAULT_CELL}
            className={cn(inputCls, "text-center", !isCell(wbsCell) && "border-rose-400")}
          />
        </div>
        {error && (
          <div className="mb-3">
            <ErrorNote message={error} />
          </div>
        )}

        <div className={cn("grid gap-2", columns.length === 2 && "grid-cols-2")}>
          {columns.map((col) => {
            const list = dayTasks.filter((t) => t.status === col);
            return (
              <section
                key={col}
                aria-label={`${col} 열`}
                className={cn(
                  "flex min-h-40 min-w-0 flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-100/60",
                  COLUMN_STYLE[col],
                )}
              >
                <header className="flex items-center justify-between px-2.5 py-2">
                  <h2 className="text-sm font-semibold">{col}</h2>
                  <span className="text-xs text-slate-500">{list.length}</span>
                </header>
                <div className="flex flex-1 flex-col gap-1.5 px-1.5 pb-1.5">
                  {list.map((t) => {
                    const over = drag?.over?.id === t.id ? drag.over : null;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          setDrag({ id: t.id });
                        }}
                        onDragEnd={() => setDrag(null)}
                        onDragOver={(e) => {
                          const moving = drag && tasks.find((x) => x.id === drag.id);
                          if (!moving || moving.id === t.id || moving.status !== t.status) return;
                          e.preventDefault();
                          const r = e.currentTarget.getBoundingClientRect();
                          const after = e.clientY > r.top + r.height / 2;
                          if (over?.after !== after) setDrag({ id: moving.id, over: { id: t.id, after } });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (over) dropOn(t, over.after);
                        }}
                        className={cn(
                          "-my-0.5 border-y-2 border-transparent py-px",
                          drag?.id === t.id && "opacity-40",
                          over && (over.after ? "border-b-indigo-500" : "border-t-indigo-500"),
                        )}
                      >
                        <TaskCard
                          task={t}
                          busy={busyId === t.id}
                          onToggle={toggle}
                          onToggleItem={toggleItem}
                          onOpen={(task) => setModal({ kind: "task", task })}
                        />
                      </div>
                    );
                  })}
                  {!list.length && <Empty>업무가 없습니다.</Empty>}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {/* ---------- 캘린더 ---------- */}
      <CalendarPanel
        tasks={tasks}
        schedules={schedules}
        mode={mode}
        onModeChange={setMode}
        company={company}
        onCompanyChange={setCompany}
        year={ym.y}
        month={ym.m}
        onMove={moveMonth}
        onToday={() => selectDate(today)}
        selected={date}
        onSelect={selectDate}
        onOpenTask={(task) => setModal({ kind: "task", task })}
        onOpenSchedule={(schedule) => setModal({ kind: "schedule", schedule })}
        onAdd={addSchedule}
        onAddTask={(d) => setModal({ kind: "task", date: d })}
        onMoveTask={moveTask}
        onMoveSchedule={moveSchedule}
      />

      {modal?.kind === "task" && (
        <TaskFormModal
          task={modal.task}
          defaultDate={modal.date}
          defaultCategory={category === "전체" ? undefined : category}
          companies={companyNames(schedules)}
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
      {modal?.kind === "schedule" && (
        <ScheduleFormModal
          schedule={modal.schedule}
          defaultDate={modal.date}
          defaultTitle={modal.title}
          defaultCategory={modal.category}
          companies={companyNames(schedules)}
          titles={scheduleTitles(schedules)}
          onClose={() => setModal(null)}
          onSaved={(s) => {
            setSchedules((l) => upsert(l, s));
            setModal(null);
          }}
          onDeleted={(id) => {
            setSchedules((l) => l.filter((s) => s.id !== id));
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
