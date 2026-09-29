import { handle, readJson } from "@/lib/server/api";
import { deleteShortcut, updateShortcut } from "@/lib/server/repository";

export const PATCH = async (req: Request, ctx: RouteContext<"/api/shortcuts/[id]">) =>
  handle(async () => updateShortcut((await ctx.params).id, await readJson(req)));

export const DELETE = async (_req: Request, ctx: RouteContext<"/api/shortcuts/[id]">) =>
  handle(async () => deleteShortcut((await ctx.params).id));
