import { handle, readJson } from "@/lib/server/api";
import { reorderLinks } from "@/lib/server/repository";

export const PUT = async (req: Request) => handle(async () => reorderLinks(await readJson(req)));
