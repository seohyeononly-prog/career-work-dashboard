import { handle, readJson } from "@/lib/server/api";
import { createShortcut, listShortcuts } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => listShortcuts());

export const POST = async (req: Request) => handle(async () => createShortcut(await readJson(req)), 201);
