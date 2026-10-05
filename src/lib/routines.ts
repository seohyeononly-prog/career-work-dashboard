// 루틴이 어느 날에 생기는지 계산하고, 칸반에 보일 가상 카드를 만든다. 서버·클라이언트 양쪽에서 사용한다.

import { addDays, fromUTCDate, toUTCDate, WEEKDAYS } from "./date";
import { isBusinessDay } from "./holidays";
import { rangeEnd, type Routine, type Task, type TaskInput } from "./types";

/** 매월 N일이 영업일이 아니면 앞/다음 영업일로 옮긴다 */
function monthlyDate(r: Routine, year: number, month: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let d = fromUTCDate(new Date(Date.UTC(year, month - 1, Math.min(r.monthDay, lastDay))));
  const step = r.holidayShift === "앞" ? -1 : 1;
  while (!isBusinessDay(d)) d = addDays(d, step);
  return d;
}

/** 루틴이 그날 생기는지: 적용 기간 안이고, 건너뛴 날이 아니고, 영업일이며 반복 규칙에 맞는 날 */
export function routineOccursOn(r: Routine, day: string): boolean {
  if (day < r.startDate || (r.endDate && day > r.endDate) || r.skipDates.includes(day)) return false;
  if (!isBusinessDay(day)) return false;
  if (r.repeat === "평일") return true;
  if (r.repeat === "요일") return r.weekdays.includes(toUTCDate(day).getUTCDay());
  // 옮긴 날짜가 달을 넘어갈 수 있어 앞뒤 달도 본다
  const d = toUTCDate(day);
  return [-1, 0, 1].some((m) => {
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1));
    return monthlyDate(r, first.getUTCFullYear(), first.getUTCMonth() + 1) === day;
  });
}

/** "평일" / "월·수·금" / "매월 10일 (휴일이면 앞 영업일)" */
export function repeatLabel(r: Pick<Routine, "repeat" | "weekdays" | "monthDay" | "holidayShift">): string {
  if (r.repeat === "평일") return "평일";
  if (r.repeat === "요일") return [...r.weekdays].sort((a, b) => a - b).map((w) => WEEKDAYS[w]).join("·") || "요일 없음";
  return `매월 ${r.monthDay}일 (휴일이면 ${r.holidayShift === "앞" ? "앞" : "다음"} 영업일)`;
}

const VIRTUAL_PREFIX = "routine:";

/** 아직 저장하지 않은 루틴 카드인지 */
export const isVirtual = (t: Task) => t.id.startsWith(VIRTUAL_PREFIX);

/** 지나간 날의 끝내지 못한 루틴 업무는 어디에도 보이지 않는다 (지연으로 쌓이지 않게) */
export const isExpiredRoutine = (t: Task, today: string) =>
  !!t.routineId && t.status !== "완료" && rangeEnd(t) < today;

/**
 * 그날 생기는 루틴 중 아직 업무로 저장되지 않은 것을 가상 카드로 만든다.
 * 지나간 날에는 만들지 않는다.
 */
export function routineCards(routines: Routine[], tasks: Task[], day: string, today: string): Task[] {
  if (day < today) return [];
  const made = new Set(tasks.filter((t) => t.routineId && t.startDate === day).map((t) => t.routineId));
  return routines
    .filter((r) => !made.has(r.id) && routineOccursOn(r, day))
    .map((r) => ({
      id: `${VIRTUAL_PREFIX}${r.id}:${day}`,
      title: r.title,
      category: r.category,
      status: "대기",
      startDate: day,
      endDate: "",
      checklist: r.checklist.map((text) => ({ text, done: false })),
      order: 0,
      routineId: r.id,
      createdAt: "",
      updatedAt: "",
    }));
}

/** 가상 카드를 업무로 저장할 때 보낼 값 */
export const taskInputOf = (t: Task): TaskInput => ({
  title: t.title,
  category: t.category,
  status: t.status,
  startDate: t.startDate,
  endDate: t.endDate,
  checklist: t.checklist,
  routineId: t.routineId,
});
