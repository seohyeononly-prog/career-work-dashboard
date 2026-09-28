import "server-only";

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

/** 서버 컴포넌트에서 데이터를 읽고, 실패하면 화면에 보여줄 메시지를 돌려준다 */
export async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.error(e);
    return { ok: false, error: (e as Error).message };
  }
}
