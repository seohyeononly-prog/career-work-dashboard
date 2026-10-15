"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { addDays, shortDate, todayStr, WEEKDAYS } from "@/lib/date";
import { isVirtual, repeatLabel, routineOccursOn, taskInputOf } from "@/lib/routines";
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  HOLIDAY_SHIFTS,
  LINK_CATEGORIES,
  REPEAT_TYPES,
  SERVICE_TYPES,
  type Category,
  type LinkCategory,
  type DateRange,
  type LinkInput,
  type LinkItem,
  type Routine,
  type RoutineInput,
  type Task,
} from "@/lib/types";
import { useToast } from "./Toast";
import { Button, CategoryBadge, Empty, ErrorNote, Field, Modal, Select, cn, inputCls } from "./ui";

function useSubmit<T>(save: () => Promise<T>, onSaved: (v: T) => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      onSaved(await save());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, submit };
}

/** 삭제 버튼·확인·토스트 문구. 루틴 업무는 삭제 대신 '이 날 건너뛰기'가 된다 */
type DeleteText = { button: string; warn: string; confirm: string; busy: string; done: (what: string) => string };
const DELETE_TEXT: DeleteText = {
  button: "삭제",
  warn: "삭제하면 되돌릴 수 없어요.",
  confirm: "삭제하기",
  busy: "삭제 중…",
  done: (what) => `${what} 삭제했어요`,
};
const SKIP_TEXT: DeleteText = {
  button: "이 날 건너뛰기",
  warn: "이 날만 루틴에서 빠지고, 다른 날은 그대로 생겨요.",
  confirm: "건너뛰기",
  busy: "건너뛰는 중…",
  done: () => "이 날은 루틴을 건너뛰었어요",
};

/**
 * 삭제 흐름: 삭제 → 창 안에서 한 번 더 확인 → 삭제 후 토스트.
 * remove가 없으면(새로 만들 때) 삭제 버튼을 보이지 않는다.
 */
function useDelete(what: string, remove?: () => Promise<void>, text = DELETE_TEXT) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  if (!remove) return { error: "", del: undefined };

  const confirm = async () => {
    setDeleting(true);
    setError("");
    try {
      await remove();
      toast(text.done(what));
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
      setConfirming(false);
    }
  };
  return {
    error,
    del: { text, confirming, deleting, ask: () => setConfirming(true), cancel: () => setConfirming(false), confirm },
  };
}
type DeleteControl = ReturnType<typeof useDelete>["del"];

function Footer({ saving, onClose, del }: { saving: boolean; onClose: () => void; del?: DeleteControl }) {
  if (del?.confirming)
    return (
      <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-100">
        <p className="mr-auto text-sm text-rose-700">{del.text.warn}</p>
        <Button type="button" onClick={del.cancel} disabled={del.deleting}>
          취소
        </Button>
        <Button
          type="button"
          className="shrink-0 border-rose-600! bg-rose-600! text-white! hover:bg-rose-700!"
          onClick={del.confirm}
          disabled={del.deleting}
          autoFocus
        >
          {del.deleting ? del.text.busy : del.text.confirm}
        </Button>
      </div>
    );

  return (
    <div className="flex justify-end gap-2 pt-2">
      {del && (
        <Button
          type="button"
          variant="ghost"
          className="mr-auto text-rose-600! hover:bg-rose-50!"
          onClick={del.ask}
          disabled={saving}
        >
          {del.text.button}
        </Button>
      )}
      <Button type="button" onClick={onClose}>
        취소
      </Button>
      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? "저장 중…" : "저장"}
      </Button>
    </div>
  );
}

/** 날짜 + "기간" 체크박스. 체크하면 종료일을 고를 수 있다. */
function DateRangeFields({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const isPeriod = value.endDate !== "";
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <Field label={isPeriod ? "시작일" : "날짜"}>
          <input
            type="date"
            className={inputCls}
            value={value.startDate}
            onChange={(e) => {
              const startDate = e.target.value;
              // 시작일을 종료일 뒤로 옮기면 종료일도 따라간다
              onChange({ startDate, endDate: isPeriod && value.endDate < startDate ? startDate : value.endDate });
            }}
            required
          />
        </Field>
        {isPeriod && (
          <>
            <span className="pb-2 text-slate-400">~</span>
            <Field label="종료일">
              <input
                type="date"
                className={inputCls}
                value={value.endDate}
                min={value.startDate}
                onChange={(e) => onChange({ ...value, endDate: e.target.value })}
                required
              />
            </Field>
          </>
        )}
      </div>
      <label className="flex w-fit items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 accent-indigo-600"
          checked={isPeriod}
          onChange={(e) =>
            onChange({ ...value, endDate: e.target.checked ? addDays(value.startDate || todayStr(), 1) : "" })
          }
        />
        기간
      </label>
    </div>
  );
}

type TaskDraft = { title: string; category: Category; memo: string; link: string } & DateRange;

/** 업무·루틴의 메모와 링크 입력칸 */
function MemoLinkFields({
  value,
  onChange,
}: {
  value: { memo: string; link: string };
  onChange: (p: { memo?: string; link?: string }) => void;
}) {
  return (
    <>
      <Field label="메모">
        <textarea
          className={cn(inputCls, "resize-y")}
          rows={3}
          value={value.memo}
          onChange={(e) => onChange({ memo: e.target.value })}
        />
      </Field>
      <Field label="링크">
        <input
          type="url"
          className={inputCls}
          placeholder="https://"
          value={value.link}
          onChange={(e) => onChange({ link: e.target.value })}
        />
      </Field>
    </>
  );
}

// ---------- 업무 ----------
export function TaskFormModal({
  task,
  defaultDate,
  defaultCategory,
  onClose,
  onSaved,
  onDeleted,
  onRoutineSaved,
}: {
  task?: Task;
  defaultDate?: string;
  defaultCategory?: Category;
  onClose: () => void;
  onSaved: (t: Task) => void;
  onDeleted?: (id: string) => void;
  /** 루틴 업무를 '이 날 건너뛰기'해서 루틴의 건너뛴 날짜가 바뀌었을 때 */
  onRoutineSaved?: (r: Routine) => void;
}) {
  const [v, setV] = useState<TaskDraft>(() => ({
    title: task?.title ?? "",
    category: task?.category ?? defaultCategory ?? DEFAULT_CATEGORY,
    startDate: task?.startDate ?? defaultDate ?? todayStr(),
    endDate: task?.endDate ?? "",
    memo: task?.memo ?? "",
    link: task?.link ?? "",
  }));
  const set = (p: Partial<TaskDraft>) => setV((s) => ({ ...s, ...p }));
  // 오늘 이후의 루틴 업무는 지우는 대신 그날만 건너뛴다 (지우기만 하면 루틴 카드가 다시 생기므로)
  const skips = !!task?.routineId && task.startDate >= todayStr();

  const { saving, error: saveError, submit } = useSubmit(() => {
    if (task && isVirtual(task)) return api.createTask({ ...taskInputOf(task), ...v });
    return task ? api.updateTask(task.id, v) : api.createTask({ ...v, status: "대기" });
  }, onSaved);
  const { error: deleteError, del } = useDelete(
    `'${task?.title}' 업무를`,
    task && onDeleted
      ? async () => {
          if (!isVirtual(task)) await api.deleteTask(task.id);
          if (skips) {
            const r = await api.skipRoutine(task.routineId, task.startDate);
            if (r) onRoutineSaved?.(r);
          }
          onDeleted(task.id);
        }
      : undefined,
    skips ? SKIP_TEXT : undefined,
  );
  const error = saveError || deleteError;

  return (
    <Modal title={task ? "업무 수정" : "새 업무"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {task?.routineId && (
          <p className="rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-700">
            ↻ 루틴에서 생긴 업무예요. 여기서 고치면 이 날만 바뀌어요.
          </p>
        )}
        <Field label="업무명">
          <input className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
        </Field>
        <Field label="카테고리">
          <Select value={v.category} options={CATEGORIES} onChange={(category) => set({ category })} />
        </Field>
        <DateRangeFields value={v} onChange={set} />
        <MemoLinkFields value={v} onChange={set} />
        {error && <ErrorNote message={error} />}
        <Footer saving={saving} onClose={onClose} del={del} />
      </form>
    </Modal>
  );
}

// ---------- 링크 ----------
export function LinkFormModal({
  link,
  category,
  onClose,
  onSaved,
  onDeleted,
}: {
  link?: LinkItem;
  category: LinkCategory;
  onClose: () => void;
  onSaved: (l: LinkItem) => void;
  onDeleted?: (id: string) => void;
}) {
  const [v, setV] = useState<LinkInput>({
    name: link?.name ?? "",
    url: link?.url ?? "",
    category: link?.category ?? category,
    service: link?.service ?? "Drive",
    description: link?.description ?? "",
    favorite: link?.favorite ?? false,
  });
  const set = (p: Partial<LinkInput>) => setV((s) => ({ ...s, ...p }));
  const { saving, error: saveError, submit } = useSubmit(
    () => (link ? api.updateLink(link.id, v) : api.createLink(v)),
    onSaved,
  );
  const { error: deleteError, del } = useDelete(
    `'${link?.name}' 링크를`,
    link && onDeleted
      ? async () => {
          await api.deleteLink(link.id);
          onDeleted(link.id);
        }
      : undefined,
  );
  const error = saveError || deleteError;

  return (
    <Modal title={link ? "링크 수정" : "새 링크"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="링크명">
          <input className={inputCls} value={v.name} onChange={(e) => set({ name: e.target.value })} required autoFocus />
        </Field>
        <Field label="URL">
          <input
            type="url"
            className={inputCls}
            placeholder="https://"
            value={v.url}
            onChange={(e) => set({ url: e.target.value })}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="카테고리">
            <Select value={v.category} options={LINK_CATEGORIES} onChange={(category) => set({ category })} />
          </Field>
          <Field label="서비스 종류">
            <Select value={v.service} options={SERVICE_TYPES} onChange={(service) => set({ service })} />
          </Field>
        </div>
        <Field label="설명">
          <input className={inputCls} value={v.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={v.favorite} onChange={(e) => set({ favorite: e.target.checked })} />
          즐겨찾기
        </label>
        {error && <ErrorNote message={error} />}
        <Footer saving={saving} onClose={onClose} del={del} />
      </form>
    </Modal>
  );
}


// ---------- 루틴 ----------
const WEEKDAY_CHOICES = [1, 2, 3, 4, 5].map((w) => ({ w, label: WEEKDAYS[w] }));

const ROUTINE_DELETE_TEXT: DeleteText = { ...DELETE_TEXT, warn: "루틴을 지워도 이미 저장된 업무는 남아요." };

/** 시작일(오늘 이전이면 오늘)부터 루틴이 생기는 날짜를 앞에서 몇 개 */
function nextDates(r: Routine, count: number): string[] {
  const out: string[] = [];
  let d = r.startDate > todayStr() ? r.startDate : todayStr();
  for (let i = 0; i < 400 && out.length < count && (!r.endDate || d <= r.endDate); i++, d = addDays(d, 1))
    if (routineOccursOn(r, d)) out.push(d);
  return out;
}

/** 루틴 목록 창. 목록에서 누르면 같은 창 안에서 수정 화면으로 바뀐다 */
export function RoutinesModal({
  routines,
  onClose,
  onSaved,
  onDeleted,
}: {
  routines: Routine[];
  onClose: () => void;
  onSaved: (r: Routine) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  if (editing)
    return (
      <RoutineForm
        routine={editing === "new" ? undefined : editing}
        onBack={() => setEditing(null)}
        onSaved={(r) => {
          onSaved(r);
          setEditing(null);
        }}
        onDeleted={(id) => {
          onDeleted(id);
          setEditing(null);
        }}
      />
    );

  const today = todayStr();
  const list = [...routines].sort(
    (a, b) => a.category.localeCompare(b.category, "ko") || a.title.localeCompare(b.title, "ko"),
  );
  return (
    <Modal title="루틴" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500">
        루틴은 영업일(주말·공휴일·대체공휴일 제외)에만 칸반에 생겨요. 체크하거나 옮기면 그날 업무로 저장되고, 지나간 날에
        못 한 루틴은 사라져요.
      </p>
      {list.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setEditing(r)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-words">{r.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <CategoryBadge c={r.category} />
                    {repeatLabel(r)}
                    {r.endDate && r.endDate < today && <span className="text-rose-600">끝남</span>}
                  </span>
                </span>
                <span className="text-slate-300">›</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>등록한 루틴이 없어요.</Empty>
      )}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" onClick={onClose}>
          닫기
        </Button>
        <Button type="button" variant="primary" onClick={() => setEditing("new")}>
          + 새 루틴
        </Button>
      </div>
    </Modal>
  );
}

function RoutineForm({
  routine,
  onBack,
  onSaved,
  onDeleted,
}: {
  routine?: Routine;
  onBack: () => void;
  onSaved: (r: Routine) => void;
  onDeleted: (id: string) => void;
}) {
  const [v, setV] = useState<RoutineInput>(() => ({
    title: routine?.title ?? "",
    category: routine?.category ?? DEFAULT_CATEGORY,
    repeat: routine?.repeat ?? "평일",
    weekdays: routine?.weekdays ?? [],
    monthDay: routine?.monthDay ?? 1,
    holidayShift: routine?.holidayShift ?? "앞",
    memo: routine?.memo ?? "",
    link: routine?.link ?? "",
    startDate: routine?.startDate ?? todayStr(),
    endDate: routine?.endDate ?? "",
  }));
  const set = (p: Partial<RoutineInput>) => setV((s) => ({ ...s, ...p }));
  const { saving, error: saveError, submit } = useSubmit(
    () => (routine ? api.updateRoutine(routine.id, v) : api.createRoutine(v)),
    onSaved,
  );
  const { error: deleteError, del } = useDelete(
    `'${routine?.title}' 루틴을`,
    routine
      ? async () => {
          await api.deleteRoutine(routine.id);
          onDeleted(routine.id);
        }
      : undefined,
    ROUTINE_DELETE_TEXT,
  );
  const error = saveError || deleteError;
  const upcoming = nextDates({ ...v, id: "", skipDates: routine?.skipDates ?? [] }, 5);
  const toggleWeekday = (w: number) =>
    set({
      weekdays: v.weekdays.includes(w) ? v.weekdays.filter((x) => x !== w) : [...v.weekdays, w].sort((a, b) => a - b),
    });

  return (
    <Modal title={routine ? "루틴 수정" : "새 루틴"} onClose={onBack}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="루틴명">
          <input className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
        </Field>
        <Field label="카테고리">
          <Select value={v.category} options={CATEGORIES} onChange={(category) => set({ category })} />
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">반복</p>
          <div className="flex gap-1" role="radiogroup" aria-label="반복">
            {REPEAT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={v.repeat === t}
                onClick={() => set({ repeat: t })}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm ring-1 transition",
                  v.repeat === t
                    ? "bg-indigo-50 font-semibold text-indigo-700 ring-indigo-300"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {t === "매월" ? "매월 N일" : t}
              </button>
            ))}
          </div>
          {v.repeat === "요일" && (
            <div className="flex gap-1">
              {WEEKDAY_CHOICES.map(({ w, label }) => {
                const on = v.weekdays.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleWeekday(w)}
                    className={cn(
                      "h-8 w-8 rounded-full text-sm ring-1 transition",
                      on
                        ? "bg-indigo-600 text-white ring-indigo-600"
                        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {v.repeat === "매월" && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              매월
              <input
                type="number"
                min={1}
                max={31}
                className={cn(inputCls, "w-18! text-center")}
                value={v.monthDay}
                onChange={(e) => set({ monthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
                aria-label="매월 날짜"
                required
              />
              일, 휴일이면
              <Select
                className="w-auto"
                ariaLabel="휴일이면 옮길 날"
                value={v.holidayShift}
                options={HOLIDAY_SHIFTS.map((s) => ({ value: s, label: s === "앞" ? "앞 영업일" : "다음 영업일" }))}
                onChange={(holidayShift) => set({ holidayShift })}
              />
            </div>
          )}
          <p className="text-xs text-slate-500">
            {v.repeat === "매월" ? "그달에 그 날짜가 없으면 말일로 봐요. " : "주말·공휴일·대체공휴일에는 생기지 않아요. "}
            {upcoming.length ? `다음: ${upcoming.map(shortDate).join(", ")}` : "앞으로 생길 날이 없어요."}
          </p>
        </div>

        <div className="flex items-end gap-2">
          <Field label="적용 시작일">
            <input
              type="date"
              className={inputCls}
              value={v.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
              required
            />
          </Field>
          <span className="pb-2 text-slate-400">~</span>
          <Field label="종료일 (비우면 계속)">
            <input
              type="date"
              className={inputCls}
              value={v.endDate}
              min={v.startDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </Field>
        </div>

        <MemoLinkFields value={v} onChange={set} />
        {error && <ErrorNote message={error} />}
        <Footer saving={saving} onClose={onBack} del={del} />
      </form>
    </Modal>
  );
}
