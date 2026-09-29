import { handle, readJson } from "@/lib/server/api";
import { reorderShortcuts } from "@/lib/server/repository";

export const PUT = async (req: Request) => handle(async () => reorderShortcuts(await readJson(req)));
