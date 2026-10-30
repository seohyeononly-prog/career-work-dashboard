import { handle, readJson } from "@/lib/server/api";
import { applyWbsSync, planWbsSync } from "@/lib/server/wbs-sync";

export const dynamic = "force-dynamic";

/** WBS 시트에 바뀔 내용 미리보기 */
export const GET = () => handle(() => planWbsSync());

/** 미리보기 token과 같은 내용이면 반영 */
export const POST = async (req: Request) => handle(async () => applyWbsSync(await readJson(req)));
