import { handle, readJson } from "@/lib/server/api";
import { skipRoutine } from "@/lib/server/repository";

export const POST = async (req: Request, ctx: RouteContext<"/api/routines/[id]/skip">) =>
  handle(async () => skipRoutine((await ctx.params).id, await readJson(req)));
