"use client";

import { useId, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { addDays, shortDate, todayStr, WEEKDAYS } from "@/lib/date";
import { isVirtual, repeatLabel, routineOccursOn, taskInputOf } from "@/lib/routines";
import {
  CATEGORIES,
  HOLIDAY_SHIFTS,
  LINK_CATEGORIES,
  REPEAT_TYPES,
  SCHEDULE_KEYWORDS,
  SERVICE_TYPES,
  type Category,
  type ChecklistItem,
  type LinkCategory,
  type DateRange,
  type LinkInput,
  type LinkItem,
  type Routine,
  type RoutineInput,
  type Schedule,
  type Task,
  companyOf,
  statusOfChecklist,
  withCompany,
  withoutCompany,
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

/** checklist는 업무에만 있다 */
type Draft = { title: string; category: Category; checklist?: ChecklistItem[] } & DateRange;

/** 기업명 비교용: 공백·대소문자 무시 */
const companyKey = (c: string) => c.replace(/\s/g, "").toLowerCase();

/** 입력칸(자동완성) + 골라 넣는 버튼. 기업·일정 이름에 쓴다 */
function PickField({
  label,
  placeholder,
  value,
  options,
  chips,
  onChange,
  autoFocus,
  required,
}: {
  label: string;
  placeholder?: string;
  value: string;
  /** 자동완성 목록 */
  options: string[];
  /** 버튼으로 보여 줄 값. 누른 버튼을 다시 누르면 비운다 */
  chips: string[];
  onChange: (c: string) => void;
  autoFocus: boolean;
  required?: boolean;
}) {
  const listId = useId();
  return (
    <div className="space-y-1.5">
      <Field label={label}>
        <input
          className={inputCls}
          list={listId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          required={required}
        />
        <datalist id={listId}>
          {options.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => {
            const on = companyKey(c) === companyKey(value);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? "" : c)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs ring-1 transition",
                  on
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-300"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 쉼표·줄바꿈으로 나눈 항목 이름들 */
const splitItems = (s: string) =>
  s
    .split(/[,\n\r\t]/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * 업무 체크리스트 편집: 같은 업무를 여러 기업에 할 때 기업마다 한 줄.
 * 입력칸에 쓰고 Enter(쉼표·줄바꿈으로 여러 개), 또는 기업 버튼을 눌러 넣고 뺀다.
 */
function ChecklistEditor({
  value,
  onChange,
  companies,
  template,
}: {
  value: ChecklistItem[];
  onChange: (v: ChecklistItem[]) => void;
  /** 버튼으로 보여 줄 기업 (일경험일 때만) */
  companies: string[];
  /** 루틴의 체크리스트 틀: 항목 이름만 정하고 체크는 하지 않는다 */
  template?: boolean;
}) {
  const [pending, setPending] = useState("");
  const has = (t: string) => value.some((c) => companyKey(c.text) === companyKey(t));
  const add = (raw: string) => {
    const items = [...new Set(splitItems(raw))].filter((t) => !has(t));
    if (items.length) onChange([...value, ...items.map((text) => ({ text, done: false }))]);
    setPending("");
  };
  const patch = (i: number, p: Partial<ChecklistItem>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const done = value.filter((c) => c.done).length;

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">
        체크리스트{" "}
        {value.length > 0 && (
          <span className="text-xs font-normal text-slate-500">
            {template ? `(${value.length}개)` : `(${done}/${value.length})`}
          </span>
        )}
      </p>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              {!template && (
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-emerald-600"
                  checked={c.done}
                  onChange={(e) => patch(i, { done: e.target.checked })}
                  aria-label={`${c.text} 완료`}
                />
              )}
              <input
                className={cn(inputCls, "py-1", c.done && "text-slate-400 line-through")}
                value={c.text}
                onChange={(e) => patch(i, { text: e.target.value })}
                aria-label="항목 이름"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="shrink-0 rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                aria-label={`${c.text} 빼기`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className={inputCls}
        placeholder="항목 추가 (Enter · 쉼표로 여러 개)"
        value={pending}
        onChange={(e) => setPending(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add(pending);
          }
        }}
        onPaste={(e) => {
          // 시트에서 기업 목록(여러 줄)을 복사해 붙여 넣으면 한 번에 여러 줄로
          const text = e.clipboardData.getData("text");
          if (/[\n\r\t]/.test(text)) {
            e.preventDefault();
            add(pending + text);
          }
        }}
        onBlur={() => pending.trim() && add(pending)}
      />
      {companies.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {companies.map((c) => {
            const on = has(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  on ? onChange(value.filter((x) => companyKey(x.text) !== companyKey(c))) : add(c)
                }
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs ring-1 transition",
                  on
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-300"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {on ? "✓ " : "+ "}
                {c}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 업무·일정 공용 입력 폼: 이름, 카테고리, 날짜(기간) */
function ItemForm<T>({
  kind,
  initial,
  isEdit,
  companies,
  titles,
  checklistCompanies = [],
  save,
  onClose,
  onSaved,
  remove,
  deleteText,
  note,
}: {
  kind: "업무" | "일정";
  /** checklist가 있으면(빈 배열 포함) 체크리스트 편집 칸을 보여 준다 */
  initial: Draft;
  isEdit: boolean;
  /** 일경험일 때 체크리스트에 기업 버튼으로 보여 줄 기업 */
  checklistCompanies?: string[];
  /** 있으면 일경험일 때 기업 칸을 보여 주고, 제목 앞에 '[기업] '을 붙여 저장한다 */
  companies?: string[];
  /** 있으면 이름 칸에 자동완성과 자주 쓰는 이름 버튼을 붙인다 */
  titles?: string[];
  save: (v: Draft) => Promise<T>;
  onClose: () => void;
  onSaved: (v: T) => void;
  /** 있으면 삭제 버튼을 보여준다 */
  remove?: () => Promise<void>;
  /** 삭제 버튼 대신 다른 동작(예: 이 날 건너뛰기)일 때 문구 */
  deleteText?: DeleteText;
  /** 제목 위에 보여 줄 안내 */
  note?: string;
}) {
  const hasCompany = (c: Category) => !!companies && c === "일경험";
  // 일경험 일정은 제목의 '[기업]'을 기업 칸으로 떼어 낸다
  const [company, setCompany] = useState(() => (hasCompany(initial.category) ? companyOf(initial.title) : ""));
  const [v, setV] = useState<Draft>(() =>
    hasCompany(initial.category) ? { ...initial, title: withoutCompany(initial.title) } : initial,
  );
  const set = (p: Partial<Draft>) => setV((s) => ({ ...s, ...p }));

  /** 카테고리를 바꾸면 기업을 제목에 합치거나 제목에서 떼어 낸다 */
  const changeCategory = (category: Category) => {
    if (hasCompany(v.category) && !hasCompany(category)) {
      set({ category, title: withCompany(company.trim(), v.title) });
      setCompany("");
    } else if (!hasCompany(v.category) && hasCompany(category)) {
      const c = companyOf(v.title);
      set({ category, title: c ? withoutCompany(v.title) : v.title });
      setCompany(c);
    } else set({ category });
  };

  /** 저장할 기업명: 대괄호를 빼고, 이미 있는 기업과 공백·대소문자만 다르면 그 이름으로 맞춘다 */
  const savedCompany = () => {
    const c = company.replace(/[[\]]/g, "").trim();
    return companies?.find((x) => companyKey(x) === companyKey(c)) ?? c;
  };
  const { saving, error: saveError, submit } = useSubmit(
    () => save(hasCompany(v.category) ? { ...v, title: withCompany(savedCompany(), v.title.trim()) } : v),
    onSaved,
  );
  const { error: deleteError, del } = useDelete(
    `'${initial.title}' ${kind}${kind === "업무" ? "를" : "을"}`,
    remove,
    deleteText,
  );
  const error = saveError || deleteError;
  // 새 일경험 일정인데 기업이 비어 있으면 기업 칸부터
  const focusCompany = hasCompany(v.category) && !isEdit && !company;

  return (
    <Modal title={isEdit ? `${kind} 수정` : `새 ${kind}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {note && <p className="rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-700">{note}</p>}
        {companies && hasCompany(v.category) && (
          <PickField
            label="기업"
            placeholder="기업명 (없으면 비워 두세요)"
            value={company}
            options={companies}
            chips={companies.slice(0, 8)}
            onChange={setCompany}
            autoFocus={focusCompany}
          />
        )}
        {titles ? (
          <PickField
            label={`${kind}명`}
            value={v.title}
            options={titles}
            chips={SCHEDULE_KEYWORDS}
            onChange={(title) => set({ title })}
            autoFocus={!focusCompany}
            required
          />
        ) : (
          <Field label={`${kind}명`}>
            <input
              className={inputCls}
              value={v.title}
              onChange={(e) => set({ title: e.target.value })}
              required
              autoFocus={!focusCompany}
            />
          </Field>
        )}
        <Field label="카테고리">
          <Select value={v.category} options={CATEGORIES} onChange={changeCategory} />
        </Field>
        <DateRangeFields value={v} onChange={set} />
        {v.checklist && (
          <ChecklistEditor
            value={v.checklist}
            onChange={(checklist) => set({ checklist })}
            companies={v.category === "일경험" ? checklistCompanies.slice(0, 12) : []}
          />
        )}
        {error && <ErrorNote message={error} />}
        <Footer saving={saving} onClose={onClose} del={del} />
      </form>
    </Modal>
  );
}

const draftOf = (
  item: Draft | undefined,
  defaults: { title?: string; category?: Category; date?: string },
): Draft =>
  item
    ? { title: item.title, category: item.category, startDate: item.startDate, endDate: item.endDate }
    : {
        title: defaults.title ?? "",
        category: defaults.category ?? CATEGORIES[0],
        startDate: defaults.date ?? todayStr(),
        endDate: "",
      };

// ---------- 업무 ----------
export function TaskFormModal({
  task,
  defaultDate,
  defaultCategory,
  companies,
  onClose,
  onSaved,
  onDeleted,
  onRoutineSaved,
}: {
  task?: Task;
  defaultDate?: string;
  defaultCategory?: Category;
  /** 체크리스트에 버튼으로 보여 줄 기업 (일정에 쓴 기업, 많이 쓴 순) */
  companies: string[];
  onClose: () => void;
  onSaved: (t: Task) => void;
  onDeleted?: (id: string) => void;
  /** 루틴 업무를 '이 날 건너뛰기'해서 루틴의 건너뛴 날짜가 바뀌었을 때 */
  onRoutineSaved?: (r: Routine) => void;
}) {
  // 오늘 이후의 루틴 업무는 지우는 대신 그날만 건너뛴다 (지우기만 하면 루틴 카드가 다시 생기므로)
  const skips = !!task?.routineId && task.startDate >= todayStr();
  return (
    <ItemForm
      kind="업무"
      isEdit={!!task}
      checklistCompanies={companies}
      initial={{ ...draftOf(task, { category: defaultCategory, date: defaultDate }), checklist: task?.checklist ?? [] }}
      note={task?.routineId ? "↻ 루틴에서 생긴 업무예요. 여기서 고치면 이 날만 바뀌어요." : undefined}
      save={({ checklist = [], ...v }) => {
        // 체크리스트가 있으면 다 체크했는지로 완료/대기를 정한다
        const status = statusOfChecklist(checklist);
        if (task && isVirtual(task))
          return api.createTask({ ...taskInputOf(task), ...v, checklist, status: status ?? task.status });
        return task
          ? api.updateTask(task.id, { ...v, checklist, ...(status && { status }) })
          : api.createTask({ ...v, checklist, status: status ?? "대기" });
      }}
      onClose={onClose}
      onSaved={onSaved}
      deleteText={skips ? SKIP_TEXT : undefined}
      remove={
        task && onDeleted
          ? async () => {
              if (!isVirtual(task)) await api.deleteTask(task.id);
              if (skips) {
                const r = await api.skipRoutine(task.routineId, task.startDate);
                if (r) onRoutineSaved?.(r);
              }
              onDeleted(task.id);
            }
          : undefined
      }
    />
  );
}

// ---------- 일정 ----------
export function ScheduleFormModal({
  schedule,
  defaultDate,
  defaultTitle,
  defaultCategory,
  companies,
  titles,
  onClose,
  onSaved,
  onDeleted,
}: {
  schedule?: Schedule;
  defaultDate?: string;
  /** 기업별 보기에서 추가할 때 '[기업] '을 미리 채운다 */
  defaultTitle?: string;
  defaultCategory?: Category;
  /** 자동완성·버튼으로 보여 줄 기업 목록 (많이 쓴 순) */
  companies: string[];
  /** 자동완성으로 보여 줄 일정 이름 ('[기업]' 뺀 제목, 많이 쓴 순) */
  titles: string[];
  onClose: () => void;
  onSaved: (s: Schedule) => void;
  onDeleted?: (id: string) => void;
}) {
  return (
    <ItemForm
      kind="일정"
      isEdit={!!schedule}
      companies={companies}
      titles={titles}
      initial={draftOf(schedule, { title: defaultTitle, category: defaultCategory, date: defaultDate })}
      save={(v) => (schedule ? api.updateSchedule(schedule.id, v) : api.createSchedule(v))}
      onClose={onClose}
      onSaved={onSaved}
      remove={
        schedule && onDeleted
          ? async () => {
              await api.deleteSchedule(schedule.id);
              onDeleted(schedule.id);
            }
          : undefined
      }
    />
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
  companies,
  onClose,
  onSaved,
  onDeleted,
}: {
  routines: Routine[];
  /** 일경험 체크리스트에 버튼으로 보여 줄 기업 */
  companies: string[];
  onClose: () => void;
  onSaved: (r: Routine) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  if (editing)
    return (
      <RoutineForm
        routine={editing === "new" ? undefined : editing}
        companies={companies}
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
  companies,
  onBack,
  onSaved,
  onDeleted,
}: {
  routine?: Routine;
  companies: string[];
  onBack: () => void;
  onSaved: (r: Routine) => void;
  onDeleted: (id: string) => void;
}) {
  const [v, setV] = useState<RoutineInput>(() => ({
    title: routine?.title ?? "",
    category: routine?.category ?? CATEGORIES[0],
    repeat: routine?.repeat ?? "평일",
    weekdays: routine?.weekdays ?? [],
    monthDay: routine?.monthDay ?? 1,
    holidayShift: routine?.holidayShift ?? "앞",
    checklist: routine?.checklist ?? [],
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

        <ChecklistEditor
          template
          value={v.checklist.map((text) => ({ text, done: false }))}
          onChange={(l) => set({ checklist: l.map((c) => c.text) })}
          companies={v.category === "일경험" ? companies.slice(0, 12) : []}
        />
        {error && <ErrorNote message={error} />}
        <Footer saving={saving} onClose={onBack} del={del} />
      </form>
    </Modal>
  );
}
