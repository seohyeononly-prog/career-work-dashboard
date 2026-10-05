import { handle, readJson } from "@/lib/server/api";
import { deleteRoutine, updateRoutine } from "@/lib/server/repository";

export const PATCH = async (req: Request, ctx: RouteContext<"/api/routines/[id]">) =>
  handle(async () => updateRoutine((await ctx.params).id, await readJson(req)));

export const DELETE = async (_req: Request, ctx: RouteContext<"/api/routines/[id]">) =>
  handle(async () => deleteRoutine((await ctx.params).id));
