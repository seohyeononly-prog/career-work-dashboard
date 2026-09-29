"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { addDays, todayStr } from "@/lib/date";
import {
  CATEGORIES,
  LINK_CATEGORIES,
  SERVICE_TYPES,
  type Category,
  type LinkCategory,
  type DateRange,
  type LinkInput,
  type LinkItem,
  type Schedule,
  type Shortcut,
  type ShortcutInput,
  type Task,
} from "@/lib/types";
import { useToast } from "./Toast";
import { Button, ErrorNote, Field, Modal, Select, inputCls } from "./ui";

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

/**
 * 삭제 흐름: 삭제 → 창 안에서 한 번 더 확인 → 삭제 후 토스트.
 * remove가 없으면(새로 만들 때) 삭제 버튼을 보이지 않는다.
 */
function useDelete(what: string, remove?: () => Promise<void>) {
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
      toast(`${what} 삭제했어요`);
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
      setConfirming(false);
    }
  };
  return {
    error,
    del: { confirming, deleting, ask: () => setConfirming(true), cancel: () => setConfirming(false), confirm },
  };
}
type DeleteControl = ReturnType<typeof useDelete>["del"];

function Footer({ saving, onClose, del }: { saving: boolean; onClose: () => void; del?: DeleteControl }) {
  if (del?.confirming)
    return (
      <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-100">
        <p className="mr-auto text-sm text-rose-700">삭제하면 되돌릴 수 없어요.</p>
        <Button type="button" onClick={del.cancel} disabled={del.deleting}>
          취소
        </Button>
        <Button
          type="button"
          className="border-rose-600! bg-rose-600! text-white! hover:bg-rose-700!"
          onClick={del.confirm}
          disabled={del.deleting}
          autoFocus
        >
          {del.deleting ? "삭제 중…" : "삭제하기"}
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
          삭제
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

type Draft = { title: string; category: Category } & DateRange;

/** 업무·일정 공용 입력 폼: 이름, 카테고리, 날짜(기간) */
function ItemForm<T>({
  kind,
  initial,
  isEdit,
  save,
  onClose,
  onSaved,
  remove,
}: {
  kind: "업무" | "일정";
  initial: Draft;
  isEdit: boolean;
  save: (v: Draft) => Promise<T>;
  onClose: () => void;
  onSaved: (v: T) => void;
  /** 있으면 삭제 버튼을 보여준다 */
  remove?: () => Promise<void>;
}) {
  const [v, setV] = useState<Draft>(initial);
  const set = (p: Partial<Draft>) => setV((s) => ({ ...s, ...p }));
  const { saving, error: saveError, submit } = useSubmit(() => save(v), onSaved);
  const { error: deleteError, del } = useDelete(
    `'${initial.title}' ${kind}${kind === "업무" ? "를" : "을"}`,
    remove,
  );
  const error = saveError || deleteError;

  return (
    <Modal title={isEdit ? `${kind} 수정` : `새 ${kind}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label={`${kind}명`}>
          <input className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
        </Field>
        <Field label="카테고리">
          <Select value={v.category} options={CATEGORIES} onChange={(category) => set({ category })} />
        </Field>
        <DateRangeFields value={v} onChange={set} />
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
  onClose,
  onSaved,
  onDeleted,
}: {
  task?: Task;
  defaultDate?: string;
  defaultCategory?: Category;
  onClose: () => void;
  onSaved: (t: Task) => void;
  onDeleted?: (id: string) => void;
}) {
  return (
    <ItemForm
      kind="업무"
      isEdit={!!task}
      initial={draftOf(task, { category: defaultCategory, date: defaultDate })}
      save={(v) => (task ? api.updateTask(task.id, v) : api.createTask({ ...v, status: "대기" }))}
      onClose={onClose}
      onSaved={onSaved}
      remove={
        task && onDeleted
          ? async () => {
              await api.deleteTask(task.id);
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
  onClose,
  onSaved,
  onDeleted,
}: {
  schedule?: Schedule;
  defaultDate?: string;
  /** 기업별 보기에서 추가할 때 '[기업] '을 미리 채운다 */
  defaultTitle?: string;
  defaultCategory?: Category;
  onClose: () => void;
  onSaved: (s: Schedule) => void;
  onDeleted?: (id: string) => void;
}) {
  return (
    <ItemForm
      kind="일정"
      isEdit={!!schedule}
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

// ---------- 사이드바 바로가기 버튼 ----------
export function ShortcutFormModal({
  shortcut,
  onClose,
  onSaved,
  onDeleted,
}: {
  shortcut?: Shortcut;
  onClose: () => void;
  onSaved: (s: Shortcut) => void;
  onDeleted?: (id: string) => void;
}) {
  const [v, setV] = useState<ShortcutInput>({ name: shortcut?.name ?? "", url: shortcut?.url ?? "" });
  const { saving, error: saveError, submit } = useSubmit(
    () => (shortcut ? api.updateShortcut(shortcut.id, v) : api.createShortcut(v)),
    onSaved,
  );
  const { error: deleteError, del } = useDelete(
    `'${shortcut?.name}' 버튼을`,
    shortcut && onDeleted
      ? async () => {
          await api.deleteShortcut(shortcut.id);
          onDeleted(shortcut.id);
        }
      : undefined,
  );
  const error = saveError || deleteError;

  return (
    <Modal title={shortcut ? "버튼 수정" : "사이드바 버튼 추가"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="버튼 이름">
          <input
            className={inputCls}
            value={v.name}
            maxLength={30}
            placeholder="예: 그룹웨어"
            onChange={(e) => setV((s) => ({ ...s, name: e.target.value }))}
            required
            autoFocus
          />
        </Field>
        <Field label="URL">
          <input
            type="url"
            className={inputCls}
            placeholder="https://"
            value={v.url}
            onChange={(e) => setV((s) => ({ ...s, url: e.target.value }))}
            required
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <Footer saving={saving} onClose={onClose} del={del} />
      </form>
    </Modal>
  );
}
