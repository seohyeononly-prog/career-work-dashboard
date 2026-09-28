import "server-only";
import { randomUUID } from "node:crypto";
import { nowStr } from "../date";
import type { DataSource, LinkItem, Schedule, Task } from "../types";
import type { z } from "zod";
import { firstIssue, linkInputSchema, scheduleInputSchema, taskInputSchema } from "../validation";
import { createDevData } from "./dev-data";
import { appendRow, ensureSheets, isSheetsConfigured, readAll, updateRow } from "./sheets";
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

function makeRepo<T extends { id: string }>(def: TableDef<T>, devKey: keyof DevDb) {
  const devList = () => devDb()[devKey] as unknown as T[];

  async function list(): Promise<T[]> {
    if (getDataSource() === "dev") return structuredClone(devList());
    await ensureSheets(ALL_TABLES);
    return readAll(def);
  }

  async function insert(item: T): Promise<T> {
    if (getDataSource() === "dev") devList().push(structuredClone(item));
    else {
      await ensureSheets(ALL_TABLES);
      await appendRow(def, item);
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
    }
    return item;
  }

  async function get(id: string): Promise<T> {
    const found = (await list()).find((x) => x.id === id);
    if (!found) throw new NotFoundError("항목을 찾을 수 없습니다.");
    return found;
  }

  return { list, insert, replace, get };
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
  return tasksRepo.insert({ id: newId("T"), ...data, createdAt: now, updatedAt: now });
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
