// 날짜 유틸리티. 모든 계산은 한국 시간(Asia/Seoul) 기준 문자열로 처리한다.

const TZ = "Asia/Seoul";

function parts(d: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return p as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

/** 오늘 날짜 (YYYY-MM-DD, KST) */
export function todayStr(now = new Date()): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 현재 일시 (YYYY-MM-DD HH:mm, KST) */
export function nowStr(now = new Date()): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD 문자열을 시간대 영향 없이 다루기 위해 UTC 자정 Date로 변환 */
export function toUTCDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromUTCDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(ymd: string, n: number): string {
  const d = toUTCDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTCDate(d);
}

/** 두 날짜의 차이(b - a, 일 단위) */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTCDate(b).getTime() - toUTCDate(a).getTime()) / 86400000);
}

/** 해당 날짜가 속한 주(일~토)의 시작일 */
export function startOfWeek(ymd: string): string {
  return addDays(ymd, -toUTCDate(ymd).getUTCDay());
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayOf(ymd: string): string {
  return WEEKDAYS[toUTCDate(ymd).getUTCDay()];
}

/** "9/28(월)" 형식 */
export function shortDate(ymd: string): string {
  const d = toUTCDate(ymd);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`;
}

/** 월 달력(일요일 시작)에 표시할 날짜 목록 */
export function monthGrid(year: number, month: number): string[] {
  const first = `${year}-${pad(month)}-01`;
  const start = startOfWeek(first);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${pad(month)}-${pad(lastDay)}`;
  const end = addDays(startOfWeek(last), 6);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export const datePart = (dt: string) => dt.slice(0, 10);
export const timePart = (dt: string) => dt.slice(11, 16);

/** HTML datetime-local 값("YYYY-MM-DDTHH:mm") <-> 저장 형식("YYYY-MM-DD HH:mm") */
export const toInputDateTime = (dt: string) => dt.replace(" ", "T");
export const fromInputDateTime = (v: string) => v.replace("T", " ").slice(0, 16);

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
