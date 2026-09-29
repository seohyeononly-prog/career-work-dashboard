import "server-only";
import { randomUUID } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import { nowStr } from "../date";
import type { DataSource, LinkItem, Schedule, Task } from "../types";
import type { z } from "zod";
import { firstIssue, linkInputSchema, scheduleInputSchema, taskInputSchema } from "../validation";
import { createDevData } from "./dev-data";
import { appendRow, deleteRow, ensureSheets, isSheetsConfigured, readAll, updateColumn, updateRow } from "./sheets";
import { LinksTable, SchedulesTable, TasksTable, type TableDef } from "./tables";

// 데이터 접근 계층. 환경변수가 설정되어 있으면 Google Sheets,
// 아니면 서버 메모리의 개발용 예시 데이터를 사용한다.

export function getDataSource(): DataSource {
  return isSheetsConfigured() ? "sheets" : "dev";
}

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

type DevDb = ReturnType<typeof createDevData>;
const g = globalThis as unknown as { __devDb?: DevDb };
const devDb = (): DevDb => (g.__devDb ??= createDevData());

const ALL_TABLES = [TasksTable, SchedulesTable, LinksTable] as unknown as TableDef<{ id: string }>[];

/**
 * 시트 읽기 결과를 잠깐 저장해 두는 시간(초). 화면 전환마다 Sheets API를 부르지 않기 위함.
 * 앱에서 쓰면 바로 비우므로, 늦게 보이는 건 시트에서 직접 고친 내용뿐이다.
 */
const READ_CACHE_SECONDS = 30;

function makeRepo<T extends { id: string }>(def: TableDef<T>, devKey: keyof DevDb) {
  const devList = () => devDb()[devKey] as unknown as T[];
  const tag = `sheet:${def.sheet}`;

  async function readFresh(): Promise<T[]> {
    await ensureSheets(ALL_TABLES);
    return readAll(def);
  }
  const readCached = unstable_cache(readFresh, [tag], { tags: [tag], revalidate: READ_CACHE_SECONDS });
  /** 쓰기 뒤에 호출해 다음 읽기가 새 값을 가져오게 한다 */
  const invalidate = () => revalidateTag(tag, { expire: 0 });

  async function list(): Promise<T[]> {
    if (getDataSource() === "dev") return structuredClone(devList());
    return readCached();
  }

  async function insert(item: T): Promise<T> {
    if (getDataSource() === "dev") devList().push(structuredClone(item));
    else {
      await ensureSheets(ALL_TABLES);
      await appendRow(def, item);
      invalidate();
    }
    return item;
  }

  async function replace(item: T): Promise<T> {
    if (getDataSource() === "dev") {
      const arr = devList();
      const i = arr.findIndex((x) => x.id === item.id);
      if (i < 0) throw new NotFoundError("항목을 찾을 수 없습니다.");
      arr[i] = structuredClone(item);
    } else {
      await ensureSheets(ALL_TABLES);
      await updateRow(def, item);
      invalidate();
    }
    return item;
  }

  /** 수정 직전 값은 캐시가 아니라 시트에서 새로 읽는다 (시트에서 직접 고친 내용을 덮어쓰지 않도록) */
  async function get(id: string): Promise<T> {
    const all = getDataSource() === "dev" ? await list() : await readFresh();
    const found = all.find((x) => x.id === id);
    if (!found) throw new NotFoundError("항목을 찾을 수 없습니다.");
    return found;
  }

  async function remove(id: string): Promise<void> {
    if (getDataSource() === "dev") {
      const arr = devList();
      const i = arr.findIndex((x) => x.id === id);
      if (i < 0) throw new NotFoundError("항목을 찾을 수 없습니다.");
      arr.splice(i, 1);
    } else {
      await ensureSheets(ALL_TABLES);
      await deleteRow(def, id);
      invalidate();
    }
  }

  return { list, insert, replace, get, remove, invalidate };
}

const tasksRepo = makeRepo(TasksTable, "tasks");
const schedulesRepo = makeRepo(SchedulesTable, "schedules");
const linksRepo = makeRepo(LinksTable, "links");

function parse<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new ValidationError(firstIssue(r.error));
  return r.data;
}

const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

// ---- 업무 ----
export const listTasks = () => tasksRepo.list();

export async function createTask(input: unknown): Promise<Task> {
  const data = parse(taskInputSchema, input);
  const now = nowStr();
  // 새 업무는 칸반 맨 위: 지금 가장 작은 순서보다 1 작게 (0은 '순서 없음'이라 항상 -1 이하)
  const order = Math.min(0, ...(await tasksRepo.list()).map((t) => t.order)) - 1;
  return tasksRepo.insert({ id: newId("T"), ...data, order, createdAt: now, updatedAt: now });
}

export async function deleteTask(id: string): Promise<{ ok: true }> {
  await tasksRepo.remove(id);
  return { ok: true };
}

/** 칸반 드래그 결과: ids 순서대로 1, 2, 3… 을 매긴다. 수정일은 바꾸지 않는다. */
export async function reorderTasks(input: unknown): Promise<{ ok: true }> {
  const ids = (input as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((x) => typeof x === "string"))
    throw new ValidationError("순서를 바꿀 업무 목록이 올바르지 않습니다.");
  const order = new Map(ids.map((id: string, i) => [id, i + 1]));
  if (getDataSource() === "dev") {
    for (const t of devDb().tasks) if (order.has(t.id)) t.order = order.get(t.id)!;
  } else {
    await ensureSheets(ALL_TABLES);
    await updateColumn(TasksTable, TasksTable.headers.indexOf("순서") + 1, order);
    tasksRepo.invalidate();
  }
  return { ok: true };
}

export async function updateTask(id: string, patch: unknown): Promise<Task> {
  const current = await tasksRepo.get(id);
  const data = parse(taskInputSchema, { ...current, ...(patch as object) });
  return tasksRepo.replace({ ...current, ...data, id, updatedAt: nowStr() });
}

// ---- 일정 ----
export const listSchedules = () => schedulesRepo.list();

export async function createSchedule(input: unknown): Promise<Schedule> {
  const data = parse(scheduleInputSchema, input);
  return schedulesRepo.insert({ id: newId("S"), ...data });
}

export async function updateSchedule(id: string, patch: unknown): Promise<Schedule> {
  const current = await schedulesRepo.get(id);
  const data = parse(scheduleInputSchema, { ...current, ...(patch as object) });
  return schedulesRepo.replace({ ...data, id });
}

// ---- 링크 ----
export const listLinks = () => linksRepo.list();

export async function createLink(input: unknown): Promise<LinkItem> {
  const data = parse(linkInputSchema, input);
  return linksRepo.insert({ id: newId("L"), ...data });
}

export async function updateLink(id: string, patch: unknown): Promise<LinkItem> {
  const current = await linksRepo.get(id);
  const data = parse(linkInputSchema, { ...current, ...(patch as object) });
  return linksRepo.replace({ ...data, id });
}
