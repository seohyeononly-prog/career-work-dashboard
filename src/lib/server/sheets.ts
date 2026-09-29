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

/**
 * 붙여 넣는 방식에 따라 달라지는 키 형식을 PEM 형식으로 정리한다.
 * - 값 전체를 감싼 따옴표 (Vercel에 "..." 째로 붙여 넣은 경우)
 * - 줄바꿈이 "\n" 또는 "\\n" 문자열로 들어간 경우
 * - Windows 줄바꿈(\r\n)
 */
export function normalizePrivateKey(raw: string): string {
  return raw
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .replace(/\\+r/g, "")
    .replace(/\\+n/g, "\n")
    .replace(/\\+\n/g, "\n")
    .replace(/\r/g, "");
}

function client(): JWT {
  if (!g.__sheetsClient) {
    g.__sheetsClient = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
      key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY!),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  return g.__sheetsClient;
}

/** 자주 나오는 인증 오류를 설정 안내 문구로 바꾼다 */
function explain(detail: string): string {
  if (/DECODER|PEM|asn1|private key/i.test(detail))
    return "GOOGLE_PRIVATE_KEY 형식이 올바르지 않습니다. 서비스 계정 JSON의 private_key 값을 그대로 붙여 넣어 주세요.";
  if (/invalid_grant|account not found/i.test(detail))
    return "서비스 계정 이메일 또는 키가 맞지 않습니다. 같은 JSON 파일의 client_email과 private_key인지 확인해 주세요.";
  if (/permission|PERMISSION_DENIED|does not have/i.test(detail))
    return "스프레드시트에 접근 권한이 없습니다. 시트를 서비스 계정 이메일에 편집자로 공유해 주세요.";
  if (/not found|NOT_FOUND/i.test(detail))
    return "스프레드시트를 찾을 수 없습니다. GOOGLE_SHEETS_SPREADSHEET_ID를 확인해 주세요.";
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(detail))
    return "Google Sheets API가 사용 설정되지 않았습니다. Google Cloud 콘솔에서 사용 설정해 주세요.";
  return detail;
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
    const hint = explain(detail);
    throw new Error(`Google Sheets 요청 실패: ${hint === detail ? detail : `${hint} (${detail})`}`);
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
        // 비어 있으면 전체를, 나중에 추가된 열(예: 순서)의 헤더가 없으면 그 칸만 쓴다
        const have = head.values?.[0]?.length ?? 0;
        if (have < d.headers.length) {
          const range = `${d.sheet}!${colLetter(have + 1)}1:${colLetter(d.headers.length)}1`;
          await call(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, "PUT", {
            values: [d.headers.slice(have)],
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

/** 여러 행의 한 열(col은 1부터)만 한 번에 바꾼다 */
export async function updateColumn<T extends { id: string }>(
  def: TableDef<T>,
  col: number,
  values: Map<string, string | number>,
) {
  const ids = await call<{ values?: string[][] }>(
    `/values/${encodeURIComponent(`${def.sheet}!A:A`)}`,
  );
  const data = (ids.values ?? []).flatMap((r, i) => {
    const id = r[0]?.trim();
    return i > 0 && id && values.has(id)
      ? [{ range: `${def.sheet}!${colLetter(col)}${i + 1}`, values: [[values.get(id)]] }]
      : [];
  });
  if (data.length) await call("/values:batchUpdate", "POST", { valueInputOption: "RAW", data });
}

/** ID로 행을 찾아 시트에서 통째로 지운다 */
export async function deleteRow<T extends { id: string }>(def: TableDef<T>, id: string) {
  const [ids, meta] = await Promise.all([
    call<{ values?: string[][] }>(`/values/${encodeURIComponent(`${def.sheet}!A:A`)}`),
    call<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
      "?fields=sheets.properties(sheetId,title)",
    ),
  ]);
  const index = (ids.values ?? []).findIndex((r) => r[0]?.trim() === id);
  if (index < 1) throw new Error(`${def.sheet} 탭에서 ID ${id}를 찾을 수 없습니다.`);
  const sheetId = meta.sheets.find((s) => s.properties.title === def.sheet)?.properties.sheetId;
  if (sheetId === undefined) throw new Error(`${def.sheet} 탭을 찾을 수 없습니다.`);
  await call(":batchUpdate", "POST", {
    requests: [
      { deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: index, endIndex: index + 1 } } },
    ],
  });
}
