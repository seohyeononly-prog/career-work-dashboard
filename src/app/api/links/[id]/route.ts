import { handle, readJson } from "@/lib/server/api";
import { updateLink } from "@/lib/server/repository";

export const PATCH = async (req: Request, ctx: RouteContext<"/api/links/[id]">) =>
  handle(async () => updateLink((await ctx.params).id, await readJson(req)));
