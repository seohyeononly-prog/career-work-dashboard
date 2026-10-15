import { HomeView } from "@/components/HomeView";
import { LoadError } from "@/components/LoadError";
import { load } from "@/lib/server/load";
import { listLinks, listRoutines, listTasks } from "@/lib/server/repository";

export default async function HomePage() {
  const res = await load(() => Promise.all([listTasks(), listLinks(), listRoutines()]));
  if (!res.ok) return <LoadError message={res.error} />;
  const [tasks, links, routines] = res.data;
  return <HomeView initialTasks={tasks} initialRoutines={routines} links={links} />;
}
