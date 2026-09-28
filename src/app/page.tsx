import { HomeView } from "@/components/HomeView";
import { LoadError } from "@/components/LoadError";
import { load } from "@/lib/server/load";
import { listLinks, listSchedules, listTasks } from "@/lib/server/repository";

export default async function HomePage() {
  const res = await load(() => Promise.all([listTasks(), listSchedules(), listLinks()]));
  if (!res.ok) return <LoadError message={res.error} />;
  const [tasks, schedules, links] = res.data;
  return <HomeView initialTasks={tasks} schedules={schedules} links={links} />;
}
