import { handle, readJson } from "@/lib/server/api";
import { deleteSchedule, updateSchedule } from "@/lib/server/repository";

export const PATCH = async (req: Request, ctx: RouteContext<"/api/schedules/[id]">) =>
  handle(async () => updateSchedule((await ctx.params).id, await readJson(req)));

export const DELETE = async (_req: Request, ctx: RouteContext<"/api/schedules/[id]">) =>
  handle(async () => deleteSchedule((await ctx.params).id));
