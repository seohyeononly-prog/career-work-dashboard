import type { Metadata } from "next";
import { LoadError } from "@/components/LoadError";
import { WorkView } from "@/components/WorkView";
import { load } from "@/lib/server/load";
import { listSchedules, listTasks } from "@/lib/server/repository";

export const metadata: Metadata = { title: "칸반보드 · 업무 대시보드" };

export default async function KanbanPage(props: PageProps<"/kanban">) {
  const { view } = await props.searchParams;
  const res = await load(() => Promise.all([listTasks(), listSchedules()]));
  if (!res.ok) return <LoadError message={res.error} />;
  const [tasks, schedules] = res.data;
  return (
    <WorkView
      initialTasks={tasks}
      initialSchedules={schedules}
      initialMode={view === "schedule" ? "schedule" : "task"}
    />
  );
}
