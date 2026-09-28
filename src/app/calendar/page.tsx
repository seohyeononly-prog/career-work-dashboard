import type { Metadata } from "next";
import { CalendarView } from "@/components/CalendarView";
import { LoadError } from "@/components/LoadError";
import { load } from "@/lib/server/load";
import { listSchedules, listTasks } from "@/lib/server/repository";

export const metadata: Metadata = { title: "캘린더 · 업무 대시보드" };

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const { view } = await props.searchParams;
  const res = await load(() => Promise.all([listTasks(), listSchedules()]));
  if (!res.ok) return <LoadError message={res.error} />;
  const [tasks, schedules] = res.data;
  return (
    <CalendarView
      initialTasks={tasks}
      initialSchedules={schedules}
      initialMode={view === "schedule" ? "schedule" : "task"}
    />
  );
}
