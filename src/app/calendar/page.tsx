import type { Metadata } from "next";
import { CalendarView } from "@/components/CalendarView";
import { LoadError } from "@/components/LoadError";
import { load } from "@/lib/server/load";
import { listTasks } from "@/lib/server/repository";

export const metadata: Metadata = { title: "캘린더 · 업무 대시보드" };

// 예전 일정 보기 주소(?view=schedule, ?view=company)도 업무 캘린더로 연다
export default async function CalendarPage() {
  const res = await load(listTasks);
  if (!res.ok) return <LoadError message={res.error} />;
  return <CalendarView initialTasks={res.data} />;
}
