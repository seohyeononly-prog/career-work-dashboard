import { handle, readJson } from "@/lib/server/api";
import { createTask, listTasks } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => listTasks());

export const POST = async (req: Request) => handle(async () => createTask(await readJson(req)), 201);
