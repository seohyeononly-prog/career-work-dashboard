import { handle, readJson } from "@/lib/server/api";
import { deleteTask, updateTask } from "@/lib/server/repository";

export const PATCH = async (req: Request, ctx: RouteContext<"/api/tasks/[id]">) =>
  handle(async () => updateTask((await ctx.params).id, await readJson(req)));

export const DELETE = async (_req: Request, ctx: RouteContext<"/api/tasks/[id]">) =>
  handle(async () => deleteTask((await ctx.params).id));
