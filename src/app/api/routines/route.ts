import { handle, readJson } from "@/lib/server/api";
import { createRoutine, listRoutines } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => listRoutines());

export const POST = async (req: Request) => handle(async () => createRoutine(await readJson(req)), 201);
