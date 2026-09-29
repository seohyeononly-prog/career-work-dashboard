import "server-only";
import {
  CATEGORIES,
  SERVICE_TYPES,
  TASK_STATUSES,
  type DateRange,
  type LinkItem,
  type Schedule,
  type Task,
} from "../types";

type Cell = string | boolean;

/** 스프레드시트 탭 정의: 탭 이름, 헤더(1행), 행 <-> 객체 변환 */
export interface TableDef<T extends { id: string }> {
  sheet: string;
  headers: string[];
  toRow(item: T): Cell[];
  fromRow(row: string[]): T | null;
}

const oneOf = <T extends string>(list: readonly T[], v: string | undefined, fallback: T): T =>
  (list as readonly string[]).includes((v ?? "").trim()) ? ((v ?? "").trim() as T) : fallback;

const pad = (n: string) => n.padStart(2, "0");

/** 시트에서 직접 입력해 "2026. 9. 28" 같은 표시 형식으로 읽힌 값도 YYYY-MM-DD로 맞춘다 */
function normDate(v: string | undefined): string {
  const m = (v ?? "").trim().match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : "";
}

function normDateTime(v: string | undefined): string {
  const s = (v ?? "").trim();
  const date = normDate(s);
  if (!date) return "";
  const t = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*$/);
  return `${date} ${t ? `${pad(t[1])}:${t[2]}` : "00:00"}`;
}

/** 시작일·종료일 칸을 읽는다. 종료일이 비었거나 시작일 이전이면 하루짜리로 본다. */
function readRange(start: string | undefined, end: string | undefined): DateRange {
  const startDate = normDate(start);
  const endDate = normDate(end);
  return { startDate, endDate: endDate > startDate ? endDate : "" };
}

const truthy = (v: string | undefined) => /^(true|y|yes|1|o|예)$/i.test((v ?? "").trim());

export const TasksTable: TableDef<Task> = {
  sheet: "Tasks",
  headers: ["업무 ID", "업무명", "카테고리", "상태", "시작일", "종료일", "생성일", "수정일"],
  toRow: (t) => [t.id, t.title, t.category, t.status, t.startDate, t.endDate, t.createdAt, t.updatedAt],
  fromRow: (r) =>
    r[0]?.trim()
      ? {
          id: r[0].trim(),
          title: r[1] ?? "",
          category: oneOf(CATEGORIES, r[2], "취업운영"),
          status: oneOf(TASK_STATUSES, r[3], "대기"),
          ...readRange(r[4], r[5]),
          createdAt: normDateTime(r[6]),
          updatedAt: normDateTime(r[7]),
        }
      : null,
};

export const SchedulesTable: TableDef<Schedule> = {
  sheet: "Schedules",
  headers: ["일정 ID", "일정명", "카테고리", "시작일", "종료일"],
  toRow: (s) => [s.id, s.title, s.category, s.startDate, s.endDate],
  fromRow: (r) =>
    r[0]?.trim()
      ? {
          id: r[0].trim(),
          title: r[1] ?? "",
          category: oneOf(CATEGORIES, r[2], "취업운영"),
          ...readRange(r[3], r[4]),
        }
      : null,
};

export const LinksTable: TableDef<LinkItem> = {
  sheet: "Links",
  headers: ["링크 ID", "링크명", "URL", "카테고리", "서비스 종류", "설명", "즐겨찾기 여부"],
  toRow: (l) => [l.id, l.name, l.url, l.category, l.service, l.description, l.favorite],
  fromRow: (r) =>
    r[0]?.trim()
      ? {
          id: r[0].trim(),
          name: r[1] ?? "",
          url: (r[2] ?? "").trim(),
          category: oneOf(CATEGORIES, r[3], "취업운영"),
          service: oneOf(SERVICE_TYPES, r[4], "기타"),
          description: r[5] ?? "",
          favorite: truthy(r[6]),
        }
      : null,
};
