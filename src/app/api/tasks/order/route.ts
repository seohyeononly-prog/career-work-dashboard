import { handle, readJson } from "@/lib/server/api";
import { reorderTasks } from "@/lib/server/repository";

export const PUT = async (req: Request) => handle(async () => reorderTasks(await readJson(req)));
