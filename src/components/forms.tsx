"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { addDays, todayStr } from "@/lib/date";
import {
  CATEGORIES,
  SERVICE_TYPES,
  type Category,
  type DateRange,
  type LinkInput,
  type LinkItem,
  type Schedule,
  type Task,
} from "@/lib/types";
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

function Footer({ saving, onClose }: { saving: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
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
}: {
  kind: "업무" | "일정";
  initial: Draft;
  isEdit: boolean;
  save: (v: Draft) => Promise<T>;
  onClose: () => void;
  onSaved: (v: T) => void;
}) {
  const [v, setV] = useState<Draft>(initial);
  const set = (p: Partial<Draft>) => setV((s) => ({ ...s, ...p }));
  const { saving, error, submit } = useSubmit(() => save(v), onSaved);

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
        <Footer saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

const draftOf = (item: Draft | undefined, defaults: { category?: Category; date?: string }): Draft =>
  item
    ? { title: item.title, category: item.category, startDate: item.startDate, endDate: item.endDate }
    : { title: "", category: defaults.category ?? "취업운영", startDate: defaults.date ?? todayStr(), endDate: "" };

// ---------- 업무 ----------
export function TaskFormModal({
  task,
  defaultDate,
  defaultCategory,
  onClose,
  onSaved,
}: {
  task?: Task;
  defaultDate?: string;
  defaultCategory?: Category;
  onClose: () => void;
  onSaved: (t: Task) => void;
}) {
  return (
    <ItemForm
      kind="업무"
      isEdit={!!task}
      initial={draftOf(task, { category: defaultCategory, date: defaultDate })}
      save={(v) => (task ? api.updateTask(task.id, v) : api.createTask({ ...v, status: "대기" }))}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

// ---------- 일정 ----------
export function ScheduleFormModal({
  schedule,
  defaultDate,
  onClose,
  onSaved,
}: {
  schedule?: Schedule;
  defaultDate?: string;
  onClose: () => void;
  onSaved: (s: Schedule) => void;
}) {
  return (
    <ItemForm
      kind="일정"
      isEdit={!!schedule}
      initial={draftOf(schedule, { date: defaultDate })}
      save={(v) => (schedule ? api.updateSchedule(schedule.id, v) : api.createSchedule(v))}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

// ---------- 링크 ----------
export function LinkFormModal({
  link,
  category,
  onClose,
  onSaved,
}: {
  link?: LinkItem;
  category: Category;
  onClose: () => void;
  onSaved: (l: LinkItem) => void;
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
  const { saving, error, submit } = useSubmit(
    () => (link ? api.updateLink(link.id, v) : api.createLink(v)),
    onSaved,
  );

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
            <Select value={v.category} options={CATEGORIES} onChange={(category) => set({ category })} />
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
        <Footer saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}
