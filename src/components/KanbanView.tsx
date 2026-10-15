"use client";

import { useState, useSyncExternalStore } from "react";
import { addDays, fullDate, todayStr } from "@/lib/date";
import { useTasks } from "@/lib/use-tasks";
import { isVirtual } from "@/lib/routines";
import { byOrder, rangeEnd, type Category, type Routine, type Task, type TaskStatus } from "@/lib/types";
import { WBS_OWNER, WBS_SECTION, wbsFields } from "@/lib/wbs";
import { RoutinesModal, TaskFormModal } from "./forms";
import { TaskCard } from "./TaskItem";
import { TaskTable } from "./TaskTable";
import { useToast } from "./Toast";
import { Button, CATEGORY_STYLE, Empty, ErrorNote, cn, inputCls } from "./ui";

/** 칸반 열 순서 */
const COLUMNS: readonly Category[] = ["취업운영", "일경험", "기타"];

const COLUMN_STYLE: Record<Category, string> = {
  취업운영: "border-t-indigo-500",
  일경험: "border-t-emerald-500",
  기타: "border-t-amber-500",
};

/** 놓을 자리: 카드 앞/뒤(card) 또는 열 안 대기·완료 칸의 빈 곳(zone, 그 칸 맨 아래) */
type Zone = { category: Category; status: TaskStatus };
type Drag = { id: string; over?: { id: string; after: boolean }; zone?: Zone };
const sameZone = (a: Zone | undefined, b: Zone) => a?.category === b.category && a.status === b.status;

const WBS_URL =
  "https://docs.google.com/spreadsheets/d/1rzAz-WZI-wsCtXZ_CDMRQjKe3mwi58HTDuvw7MqQ8dY/edit?gid=1496926969#gid=1496926969&range=";
const WBS_DEFAULT_CELL = "A60";
const WBS_CELL_KEY = "wbs-cell";
/** 완료 업무 숨기기 (localStorage, 켜면 "1") */
const HIDE_DONE_KEY = "kanban-hide-done";
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
function readHideDone() {
  try {
    return localStorage.getItem(HIDE_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

/** 마감보고 한 줄: 본부명을 앞에 붙이고, 기타 카테고리는 카테고리명을 뺀다 */
const reportLine = (t: Task) => `[교육사업본부] ${t.category === "기타" ? "" : `${t.category} `}${t.title}`;

/**
 * WBS 한 행(B~J열)을 탭으로 나눈 줄. 시트에 붙이면 칸마다 나뉘어 들어간다.
 * 구분(기업명 또는 구역) · 담당자 · 본부 · 유형 · 업무명 · G·H(빈칸) · 시작일 · 종료일
 */
function wbsRow(t: Task) {
  const w = wbsFields(t);
  return [w.group, WBS_OWNER, w.org, w.type, w.name, "", "", t.startDate, rangeEnd(t)].join("\t");
}

/** 칸반보드: 취업운영 / 일경험 / 기타 열, 열마다 대기 위·완료 아래 */
export function KanbanView({
  initialTasks,
  initialRoutines,
}: {
  initialTasks: Task[];
  initialRoutines: Routine[];
}) {
  const today = todayStr();
  const { tasks, tasksOn, cardsOn, routines, busyId, error, toggle, patchTask, save, remove, arrange, saveRoutine, removeRoutine } =
    useTasks(initialTasks, initialRoutines);
  const [date, setDate] = useState(today);
  const [modal, setModal] = useState<{ task?: Task; category?: Category } | null>(null);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const toast = useToast();

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

  // 완료 숨기기도 이 브라우저에 기억한다
  const savedHideDone = useSyncExternalStore(noSubscribe, readHideDone, () => false);
  const [editedHideDone, setHideDone] = useState<boolean | null>(null);
  const hideDone = editedHideDone ?? savedHideDone;
  const changeHideDone = (v: boolean) => {
    setHideDone(v);
    try {
      localStorage.setItem(HIDE_DONE_KEY, v ? "1" : "0");
    } catch {}
  };

  const selectDate = (d: string) => {
    if (d) setDate(d);
  };

  /** 선택한 날짜의 업무 전체(아직 저장하지 않은 루틴 카드 포함). 드래그 순서의 기준 */
  const dayTasks = tasksOn(date).sort(byOrder);
  const zoneTasks = (z: Zone) => dayTasks.filter((t) => t.category === z.category && t.status === z.status);

  /**
   * 끌던 카드를 대상 카드 앞/뒤(target) 또는 칸 맨 아래(target 없음)로 옮기고, 그날 업무 전체에 순서를 다시 매긴다.
   * 다른 열이면 카테고리를, 대기·완료 칸이 다르면 상태를 바꾼다.
   */
  const dropOn = (zone: Zone, target?: { id: string; after: boolean }) => {
    const moving = dayTasks.find((t) => t.id === drag?.id);
    setDrag(null);
    if (!moving || moving.id === target?.id) return;
    const rest = dayTasks.filter((t) => t.id !== moving.id);
    const at = target
      ? rest.findIndex((t) => t.id === target.id) + (target.after ? 1 : 0)
      : rest.findLastIndex((t) => t.category === zone.category && t.status === zone.status) + 1 || rest.length;
    const patch = {
      ...(moving.status !== zone.status && { status: zone.status }),
      ...(moving.category !== zone.category && { category: zone.category }),
    };
    const list = [...rest.slice(0, at), { ...moving, ...patch }, ...rest.slice(at)];
    const changed = Object.keys(patch).length > 0;
    const sameOrder = list.every((t, i) => t.id === dayTasks[i].id);
    // 제자리에 놓았으면 아무것도 하지 않는다 (순서가 아직 없던 날이면 이번에 매긴다)
    const saved = list.filter((t) => !isVirtual(t));
    if (!changed && sameOrder && (isVirtual(moving) || saved.every((t, i) => t.order === i + 1))) return;
    arrange(list, moving, patch);
  };

  /** 한 열의 업무를 화면 순서(대기 → 완료, 칸 안 순서)대로 */
  const columnTasks = (category: Category) =>
    (["대기", "완료"] as const).flatMap((status) => zoneTasks({ category, status }));

  const copyLines = async (lines: string[], name: string) => {
    if (!lines.length) return toast("복사할 업무가 없어요", "error");
    try {
      await copyText(lines.join("\n"));
      toast(`${name} ${lines.length}건을 복사했어요`);
    } catch {
      toast("복사하지 못했어요. 다시 시도해 주세요", "error");
    }
  };
  /** 선택한 날짜의 업무 전체를 열 순서대로 */
  const copyReport = () => copyLines(COLUMNS.flatMap(columnTasks).map(reportLine), "마감보고");
  /** 한 열을 WBS 행 형식으로. 루틴은 WBS 루틴 구역에 따로 있으므로 뺀다 */
  const copyWbs = (category: Category) =>
    copyLines(
      columnTasks(category).filter((t) => !t.routineId).map(wbsRow),
      `WBS ${WBS_SECTION[category]}`,
    );
  /** 업무 목록 표: 끝내지 않은 업무와 아직 끝나지 않은 완료 업무, 오늘부터 일주일 치 루틴 카드 */
  const tableTasks = [
    ...tasks.filter((t) => t.status !== "완료" || rangeEnd(t) >= today),
    ...Array.from({ length: 7 }, (_, i) => cardsOn(addDays(today, i))).flat(),
  ];
  const copyTable = async (text: string, count: number) => {
    try {
      await copyText(text);
      toast(`${count}줄을 복사했어요`);
    } catch {
      toast("복사하지 못했어요. 다시 시도해 주세요", "error");
    }
  };

  const openWbs = () => window.open(WBS_URL + (isCell(wbsCell) ? wbsCell : WBS_DEFAULT_CELL), "_blank", "noopener");

  /** 대기·완료 칸 하나: 빈 곳에 놓으면 칸 맨 아래로 */
  const renderZone = (zone: Zone) => {
    const list = zoneTasks(zone);
    const active = sameZone(drag?.zone, zone);
    return (
      <div
        aria-label={`${zone.category} ${zone.status}`}
        onDragOver={(e) => {
          if (!drag) return;
          e.preventDefault();
          if (!active) setDrag({ id: drag.id, zone });
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (active) dropOn(zone);
        }}
        className={cn(
          "flex flex-col gap-1.5 rounded-md p-1 transition",
          zone.status === "대기" ? "min-h-24 flex-1" : "min-h-12",
          active && "bg-indigo-50 ring-2 ring-indigo-300",
        )}
      >
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
                // 카드 위에서는 칸(빈 곳) 처리로 넘기지 않는다
                e.stopPropagation();
                if (!drag) return;
                if (drag.id === t.id) {
                  if (drag.over || drag.zone) setDrag({ id: drag.id });
                  return;
                }
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > r.top + r.height / 2;
                if (over?.after !== after) setDrag({ id: drag.id, over: { id: t.id, after } });
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (over) dropOn(zone, over);
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
                hideCategory
                onToggle={toggle}
                onOpen={(task) => setModal({ task })}
              />
            </div>
          );
        })}
        {!list.length &&
          (zone.status === "대기" ? (
            <Empty>업무가 없습니다.</Empty>
          ) : (
            <p className="px-1.5 py-1 text-xs text-slate-400">완료한 업무가 없어요</p>
          ))}
      </div>
    );
  };

  return (
    <section aria-label="칸반보드" className="@container min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-base font-semibold">칸반보드</h1>
        <Button onClick={copyReport}>마감보고 복사</Button>
        <Button onClick={openWbs}>WBS 열기</Button>
        <input
          value={wbsCell}
          onChange={(e) => changeWbsCell(e.target.value)}
          aria-label="WBS 열 때 이동할 셀 위치"
          title="WBS 열 때 이동할 셀 위치"
          placeholder={WBS_DEFAULT_CELL}
          className={cn(inputCls, "w-18! text-center", !isCell(wbsCell) && "border-rose-400")}
        />
        <Button onClick={() => setRoutinesOpen(true)} title="반복 업무 관리">
          <span aria-hidden>↻</span> 루틴
        </Button>
        <Button variant="primary" onClick={() => setModal({})}>
          + 새 업무
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Button className="px-2" onClick={() => selectDate(addDays(date, -1))} aria-label="전날">
          ‹
        </Button>
        <label className="relative w-56 max-w-full">
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
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-indigo-600"
            checked={hideDone}
            onChange={(e) => changeHideDone(e.target.checked)}
          />
          완료 숨기기
        </label>
      </div>

      {error && (
        <div className="mb-3">
          <ErrorNote message={error} />
        </div>
      )}

      {/* 칸반 영역 폭이 660px 이하일 때만 열을 위아래로 쌓는다 */}
      <div className="grid gap-3 @min-[661px]:grid-cols-3">
        {COLUMNS.map((category) => {
          const waiting = zoneTasks({ category, status: "대기" }).length;
          const done = zoneTasks({ category, status: "완료" }).length;
          return (
            <section
              key={category}
              aria-label={`${category} 열`}
              className={cn(
                "flex min-w-0 flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-100/60",
                COLUMN_STYLE[category],
              )}
            >
              <header className="flex items-center gap-2 px-2.5 py-2">
                <span className={cn("h-2 w-2 rounded-full", CATEGORY_STYLE[category].dot)} />
                <h2 className="text-sm font-semibold">{category}</h2>
                <button
                  type="button"
                  onClick={() => copyWbs(category)}
                  title={`WBS ${WBS_SECTION[category]} 구역에 붙일 행 복사 (B열에 붙여 넣기)`}
                  className="mr-auto rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700"
                >
                  WBS 복사
                </button>
                <span className="text-xs text-slate-500">
                  대기 {waiting} · 완료 {done}
                </span>
              </header>
              <div className="flex flex-1 flex-col px-1.5 pb-1.5">
                {renderZone({ category, status: "대기" })}
                <div className="mx-1 mt-1.5 mb-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span className="h-px flex-1 border-t border-dashed border-slate-300" />
                  {hideDone ? `완료 ${done}건 숨김` : "완료"}
                  <span className="h-px flex-1 border-t border-dashed border-slate-300" />
                </div>
                {!hideDone && renderZone({ category, status: "완료" })}
                <button
                  type="button"
                  onClick={() => setModal({ category })}
                  className="mt-1 rounded-md py-1.5 text-sm text-slate-500 hover:bg-white hover:text-slate-700"
                >
                  + 추가
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <TaskTable
        tasks={tableTasks}
        routines={routines}
        today={today}
        hideDone={hideDone}
        busyId={busyId}
        onToggle={toggle}
        onPatch={patchTask}
        onOpen={(task) => setModal({ task })}
        onCopied={copyTable}
      />

      {modal && (
        <TaskFormModal
          task={modal.task}
          defaultDate={date}
          defaultCategory={modal.category}
          onClose={() => setModal(null)}
          onSaved={(t) => {
            save(t, modal.task && isVirtual(modal.task) ? modal.task.id : undefined);
            setModal(null);
          }}
          onDeleted={(id) => {
            remove(id);
            setModal(null);
          }}
          onRoutineSaved={saveRoutine}
        />
      )}

      {routinesOpen && (
        <RoutinesModal
          routines={routines}
          onClose={() => setRoutinesOpen(false)}
          onSaved={saveRoutine}
          onDeleted={removeRoutine}
        />
      )}
    </section>
  );
}
