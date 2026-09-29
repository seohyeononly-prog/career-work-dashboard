// 브라우저에서 호출하는 API 래퍼. 자격 증명 없이 우리 서버의 /api 라우트만 호출한다.
import type { LinkInput, LinkItem, Schedule, ScheduleInput, Shortcut, ShortcutInput, Task, TaskInput } from "./types";

async function request<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "요청을 처리하지 못했습니다.");
  return data as T;
}

export const api = {
  createTask: (v: TaskInput) => request<Task>("/api/tasks", "POST", v),
  updateTask: (id: string, v: Partial<TaskInput>) =>
    request<Task>(`/api/tasks/${encodeURIComponent(id)}`, "PATCH", v),
  deleteTask: (id: string) => request<{ ok: true }>(`/api/tasks/${encodeURIComponent(id)}`, "DELETE"),
  reorderTasks: (ids: string[]) => request<{ ok: true }>("/api/tasks/order", "PUT", { ids }),
  createSchedule: (v: ScheduleInput) => request<Schedule>("/api/schedules", "POST", v),
  updateSchedule: (id: string, v: Partial<ScheduleInput>) =>
    request<Schedule>(`/api/schedules/${encodeURIComponent(id)}`, "PATCH", v),
  deleteSchedule: (id: string) =>
    request<{ ok: true }>(`/api/schedules/${encodeURIComponent(id)}`, "DELETE"),
  createLink: (v: LinkInput) => request<LinkItem>("/api/links", "POST", v),
  updateLink: (id: string, v: Partial<LinkInput>) =>
    request<LinkItem>(`/api/links/${encodeURIComponent(id)}`, "PATCH", v),
  deleteLink: (id: string) => request<{ ok: true }>(`/api/links/${encodeURIComponent(id)}`, "DELETE"),
  reorderLinks: (ids: string[]) => request<{ ok: true }>("/api/links/order", "PUT", { ids }),
  createShortcut: (v: ShortcutInput) => request<Shortcut>("/api/shortcuts", "POST", v),
  updateShortcut: (id: string, v: Partial<ShortcutInput>) =>
    request<Shortcut>(`/api/shortcuts/${encodeURIComponent(id)}`, "PATCH", v),
  deleteShortcut: (id: string) =>
    request<{ ok: true }>(`/api/shortcuts/${encodeURIComponent(id)}`, "DELETE"),
};

/** 목록에서 같은 ID 항목을 교체하거나 새로 추가 */
export function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}
