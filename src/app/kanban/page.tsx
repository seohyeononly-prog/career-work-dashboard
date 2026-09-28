import type { Metadata } from "next";
import { KanbanView } from "@/components/KanbanView";
import { LoadError } from "@/components/LoadError";
import { load } from "@/lib/server/load";
import { listTasks } from "@/lib/server/repository";

export const metadata: Metadata = { title: "칸반보드 · 업무 대시보드" };

export default async function KanbanPage() {
  const res = await load(listTasks);
  if (!res.ok) return <LoadError message={res.error} />;
  return <KanbanView initialTasks={res.data} />;
}
