import "server-only";
import { NextResponse } from "next/server";
import { NotFoundError, ValidationError } from "./repository";

/** 라우트 핸들러 공통 처리: 결과를 JSON으로, 오류를 상태 코드와 한국어 메시지로 변환 */
export async function handle(fn: () => Promise<unknown>, status = 200) {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    const code = e instanceof ValidationError ? 400 : e instanceof NotFoundError ? 404 : 500;
    if (code === 500) console.error(e);
    return NextResponse.json({ error: (e as Error).message }, { status: code });
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError("요청 본문이 올바른 JSON이 아닙니다.");
  }
}
