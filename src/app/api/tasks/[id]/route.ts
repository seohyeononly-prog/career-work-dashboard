import { handle, readJson } from "@/lib/server/api";
import { updateTask } from "@/lib/server/repository";

export const PATCH = async (req: Request, ctx: RouteContext<"/api/tasks/[id]">) =>
  handle(async () => updateTask((await ctx.params).id, await readJson(req)));
