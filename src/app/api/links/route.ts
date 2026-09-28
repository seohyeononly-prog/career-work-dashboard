import { handle, readJson } from "@/lib/server/api";
import { createLink, listLinks } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => listLinks());

export const POST = async (req: Request) => handle(async () => createLink(await readJson(req)), 201);
