"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { fromInputDateTime, toInputDateTime, todayStr } from "@/lib/date";
import {
  CATEGORIES,
  PRIORITIES,
  SERVICE_TYPES,
  TASK_STATUSES,
  type Category,
  type LinkInput,
  type LinkItem,
  type Schedule,
  type ScheduleInput,
  type Task,
  type TaskInput,
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

// ---------- 업무 ----------
export function TaskFormModal({
  task,
  defaults,
  onClose,
  onSaved,
}: {
  task?: Task;
  defaults?: Partial<TaskInput>;
  onClose: () => void;
  onSaved: (t: Task) => void;
}) {
  const [v, setV] = useState<TaskInput>({
    title: task?.title ?? "",
    category: task?.category ?? defaults?.category ?? "취업운영",
    status: task?.status ?? defaults?.status ?? "대기",
    dueDate: task?.dueDate ?? defaults?.dueDate ?? todayStr(),
    priority: task?.priority ?? "보통",
    description: task?.description ?? "",
  });
  const set = (p: Partial<TaskInput>) => setV((s) => ({ ...s, ...p }));
  const { saving, error, submit } = useSubmit(
    () => (task ? api.updateTask(task.id, v) : api.createTask(v)),
    onSaved,
  );

  return (
    <Modal title={task ? "업무 수정" : "새 업무"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="업무명">
          <input className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="카테고리">
            <Select value={v.category} options={CATEGORIES} onChange={(category) => set({ category })} />
          </Field>
          <Field label="상태">
            <Select value={v.status} options={TASK_STATUSES} onChange={(status) => set({ status })} />
          </Field>
          <Field label="마감일">
            <input type="date" className={inputCls} value={v.dueDate} onChange={(e) => set({ dueDate: e.target.value })} required />
          </Field>
          <Field label="중요도">
            <Select value={v.priority} options={PRIORITIES} onChange={(priority) => set({ priority })} />
          </Field>
        </div>
        <Field label="설명">
          <textarea className={inputCls} rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        {error && <ErrorNote message={error} />}
        <Footer saving={saving} onClose={onClose} />
      </form>
    </Modal>
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
  const day = defaultDate ?? todayStr();
  const [v, setV] = useState<ScheduleInput>({
    title: schedule?.title ?? "",
    category: schedule?.category ?? "취업운영",
    start: schedule?.start ?? `${day} 10:00`,
    end: schedule?.end ?? `${day} 11:00`,
    location: schedule?.location ?? "",
    description: schedule?.description ?? "",
  });
  const set = (p: Partial<ScheduleInput>) => setV((s) => ({ ...s, ...p }));
  const { saving, error, submit } = useSubmit(
    () => (schedule ? api.updateSchedule(schedule.id, v) : api.createSchedule(v)),
    onSaved,
  );

  return (
    <Modal title={schedule ? "일정 수정" : "새 일정"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="일정명">
          <input className={inputCls} value={v.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
        </Field>
        <Field label="카테고리">
          <Select value={v.category} options={CATEGORIES} onChange={(category) => set({ category })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="시작일시">
            <input
              type="datetime-local"
              className={inputCls}
              value={toInputDateTime(v.start)}
              onChange={(e) => {
                const start = fromInputDateTime(e.target.value);
                set(start > v.end ? { start, end: start } : { start });
              }}
              required
            />
          </Field>
          <Field label="종료일시">
            <input
              type="datetime-local"
              className={inputCls}
              value={toInputDateTime(v.end)}
              onChange={(e) => set({ end: fromInputDateTime(e.target.value) })}
              required
            />
          </Field>
        </div>
        <Field label="장소">
          <input className={inputCls} value={v.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="설명">
          <textarea className={inputCls} rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        {error && <ErrorNote message={error} />}
        <Footer saving={saving} onClose={onClose} />
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
