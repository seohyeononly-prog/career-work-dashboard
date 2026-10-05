import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KanbanView } from "@/components/KanbanView";
import { LoadError } from "@/components/LoadError";
import { load } from "@/lib/server/load";
import { listRoutines, listSchedules, listTasks } from "@/lib/server/repository";

export const metadata: Metadata = { title: "칸반보드 · 업무 대시보드" };

export default async function KanbanPage(props: PageProps<"/kanban">) {
  // 캘린더가 한 화면에 있던 때의 주소(?view=)는 캘린더 화면으로 넘겨준다
  const { view } = await props.searchParams;
  if (typeof view === "string") redirect(`/calendar?view=${view}`);
  const res = await load(() => Promise.all([listTasks(), listSchedules(), listRoutines()]));
  if (!res.ok) return <LoadError message={res.error} />;
  const [tasks, schedules, routines] = res.data;
  return <KanbanView initialTasks={tasks} initialRoutines={routines} schedules={schedules} />;
}
