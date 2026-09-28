import "server-only";
import { JWT } from "google-auth-library";
import type { TableDef } from "./tables";

// Google Sheets API 호출은 이 파일(서버)에서만 한다.
// 서비스 계정 자격 증명은 환경변수로만 읽으며 브라우저로 전달되지 않는다.

const API = "https://sheets.googleapis.com/v4/spreadsheets";

export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

const g = globalThis as unknown as {
  __sheetsClient?: JWT;
  __sheetsReady?: Promise<void>;
};

function client(): JWT {
  if (!g.__sheetsClient) {
    g.__sheetsClient = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // Vercel 등에서 한 줄로 입력한 경우 "\n" 문자열을 실제 줄바꿈으로 복원
      key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  return g.__sheetsClient;
}

async function call<T>(path: string, method: "GET" | "POST" | "PUT" = "GET", data?: unknown): Promise<T> {
  const url = `${API}/${process.env.GOOGLE_SHEETS_SPREADSHEET_ID}${path}`;
  try {
    const res = await client().request<T>({ url, method, data });
    return res.data;
  } catch (e) {
    const detail =
      (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message ?? (e as Error).message;
    throw new Error(`Google Sheets 요청 실패: ${detail}`);
  }
}

const colLetter = (n: number) => String.fromCharCode(64 + n); // 최대 26열이면 충분

/** 탭이 없으면 만들고, 1행이 비어 있으면 헤더를 쓴다. 프로세스당 한 번 실행. */
export function ensureSheets(defs: TableDef<{ id: string }>[]): Promise<void> {
  if (!g.__sheetsReady) {
    g.__sheetsReady = (async () => {
      const meta = await call<{ sheets: { properties: { title: string } }[] }>(
        "?fields=sheets.properties.title",
      );
      const existing = new Set(meta.sheets.map((s) => s.properties.title));
      const missing = defs.filter((d) => !existing.has(d.sheet));
      if (missing.length) {
        await call(":batchUpdate", "POST", {
          requests: missing.map((d) => ({ addSheet: { properties: { title: d.sheet } } })),
        });
      }
      for (const d of defs) {
        const head = await call<{ values?: string[][] }>(
          `/values/${encodeURIComponent(`${d.sheet}!1:1`)}`,
        );
        if (!head.values?.[0]?.length) {
          const range = `${d.sheet}!A1:${colLetter(d.headers.length)}1`;
          await call(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, "PUT", {
            values: [d.headers],
          });
        }
      }
    })().catch((e) => {
      g.__sheetsReady = undefined; // 실패하면 다음 요청에서 다시 시도
      throw e;
    });
  }
  return g.__sheetsReady;
}

export async function readAll<T extends { id: string }>(def: TableDef<T>): Promise<T[]> {
  const range = `${def.sheet}!A2:${colLetter(def.headers.length)}`;
  const res = await call<{ values?: string[][] }>(
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
  );
  return (res.values ?? []).map((r) => def.fromRow(r)).filter((x): x is T => x !== null);
}

export async function appendRow<T extends { id: string }>(def: TableDef<T>, item: T) {
  const range = `${def.sheet}!A:${colLetter(def.headers.length)}`;
  await call(
    `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    "POST",
    { values: [def.toRow(item)] },
  );
}

export async function updateRow<T extends { id: string }>(def: TableDef<T>, item: T) {
  const ids = await call<{ values?: string[][] }>(
    `/values/${encodeURIComponent(`${def.sheet}!A:A`)}`,
  );
  const index = (ids.values ?? []).findIndex((r) => r[0]?.trim() === item.id);
  if (index < 1) throw new Error(`${def.sheet} 탭에서 ID ${item.id}를 찾을 수 없습니다.`);
  const row = index + 1;
  const range = `${def.sheet}!A${row}:${colLetter(def.headers.length)}${row}`;
  await call(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, "PUT", {
    values: [def.toRow(item)],
  });
}
