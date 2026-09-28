import { handle, readJson } from "@/lib/server/api";
import { updateSchedule } from "@/lib/server/repository";

export const PATCH = async (req: Request, ctx: RouteContext<"/api/schedules/[id]">) =>
  handle(async () => updateSchedule((await ctx.params).id, await readJson(req)));
