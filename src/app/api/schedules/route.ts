import { handle, readJson } from "@/lib/server/api";
import { createSchedule, listSchedules } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => listSchedules());

export const POST = async (req: Request) => handle(async () => createSchedule(await readJson(req)), 201);
