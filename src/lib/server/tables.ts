import "server-only";
import { WEEKDAYS } from "../date";
import {
  CATEGORIES,
  HOLIDAY_SHIFTS,
  LINK_CATEGORIES,
  REPEAT_TYPES,
  SERVICE_TYPES,
  TASK_STATUSES,
  type DateRange,
  type LinkItem,
  type Routine,
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

/** 체크리스트 칸: 한 줄에 하나씩 '[x] 기업A' / '[ ] 기업B'. 시트에서 직접 고치기 쉽게 글로 저장한다 */
const checklistToCell = (list: Task["checklist"]) => list.map((c) => `[${c.done ? "x" : " "}] ${c.text}`).join("\n");

function checklistFromCell(v: string | undefined): Task["checklist"] {
  return (v ?? "")
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^\s*\[(.?)\]\s*(.*)$/);
      return m ? { text: m[2].trim(), done: m[1].trim() !== "" } : { text: line.trim(), done: false };
    })
    .filter((c) => c.text);
}

const truthy = (v: string | undefined) => /^(true|y|yes|1|o|예)$/i.test((v ?? "").trim());

export const TasksTable: TableDef<Task> = {
  sheet: "Tasks",
  headers: ["업무 ID", "업무명", "카테고리", "상태", "시작일", "종료일", "생성일", "수정일", "순서", "체크리스트", "루틴 ID"],
  toRow: (t) => [
    t.id,
    t.title,
    t.category,
    t.status,
    t.startDate,
    t.endDate,
    t.createdAt,
    t.updatedAt,
    t.order ? String(t.order) : "",
    checklistToCell(t.checklist),
    t.routineId,
  ],
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
          order: Number(r[8]) || 0,
          checklist: checklistFromCell(r[9]),
          routineId: (r[10] ?? "").trim(),
        }
      : null,
};

/** 요일 칸: "월,수,금". 영업일 루틴이라 월~금만 읽는다 */
const weekdaysToCell = (list: number[]) => list.map((w) => WEEKDAYS[w]).join(",");
const weekdaysFromCell = (v: string | undefined) =>
  [...new Set((v ?? "").split(/[,·\s]+/).map((w) => WEEKDAYS.indexOf(w.trim())))]
    .filter((w) => w >= 1 && w <= 5)
    .sort((a, b) => a - b);

/** 날짜 목록 칸: 쉼표로 구분 */
const datesFromCell = (v: string | undefined) => (v ?? "").split(/[,\s]+/).map(normDate).filter(Boolean);

export const RoutinesTable: TableDef<Routine> = {
  sheet: "Routines",
  headers: ["루틴 ID", "루틴명", "카테고리", "반복", "요일", "매월 날짜", "휴일이면", "체크리스트", "시작일", "종료일", "건너뛴 날짜"],
  toRow: (r) => [
    r.id,
    r.title,
    r.category,
    r.repeat,
    weekdaysToCell(r.weekdays),
    r.repeat === "매월" ? String(r.monthDay) : "",
    r.holidayShift,
    r.checklist.join("\n"),
    r.startDate,
    r.endDate,
    r.skipDates.join(","),
  ],
  fromRow: (r) =>
    r[0]?.trim()
      ? {
          id: r[0].trim(),
          title: r[1] ?? "",
          category: oneOf(CATEGORIES, r[2], "취업운영"),
          repeat: oneOf(REPEAT_TYPES, r[3], "평일"),
          weekdays: weekdaysFromCell(r[4]),
          monthDay: Math.min(31, Math.max(1, Number(r[5]) || 1)),
          holidayShift: oneOf(HOLIDAY_SHIFTS, r[6], "앞"),
          checklist: (r[7] ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
          // 업무와 달리 시작일 = 종료일도 그대로 둔다 (""는 '계속'이라서)
          startDate: normDate(r[8]),
          endDate: normDate(r[9]) >= normDate(r[8]) ? normDate(r[9]) : "",
          skipDates: datesFromCell(r[10]),
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
  headers: ["링크 ID", "링크명", "URL", "카테고리", "서비스 종류", "설명", "즐겨찾기 여부", "순서"],
  toRow: (l) => [l.id, l.name, l.url, l.category, l.service, l.description, l.favorite, l.order ? String(l.order) : ""],
  fromRow: (r) =>
    r[0]?.trim()
      ? {
          id: r[0].trim(),
          name: r[1] ?? "",
          url: (r[2] ?? "").trim(),
          category: oneOf(LINK_CATEGORIES, r[3], "취업운영"),
          service: oneOf(SERVICE_TYPES, r[4], "기타"),
          description: r[5] ?? "",
          favorite: truthy(r[6]),
          order: Number(r[7]) || 0,
        }
      : null,
};
