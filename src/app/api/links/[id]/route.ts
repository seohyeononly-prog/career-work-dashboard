import { handle, readJson } from "@/lib/server/api";
import { deleteLink, updateLink } from "@/lib/server/repository";

export const PATCH = async (req: Request, ctx: RouteContext<"/api/links/[id]">) =>
  handle(async () => updateLink((await ctx.params).id, await readJson(req)));

export const DELETE = async (_req: Request, ctx: RouteContext<"/api/links/[id]">) =>
  handle(async () => deleteLink((await ctx.params).id));
