import "server-only";
import { createHash } from "node:crypto";
import { addDays, todayStr } from "../date";
import { rangeEnd, type Category, type Task } from "../types";
import { WBS_GID, WBS_OWNER, WBS_SECTION, wbsFields, type WbsChange, type WbsPlan } from "../wbs";
import { listTasks, ValidationError } from "./repository";
import { isSheetsConfigured } from "./sheets";

// 칸반 업무를 WBS 시트에 맞춘다. 업무 ID는 N열(비고)에 적어 두고 그걸로 행을 찾는다.
// 새로 넣는 건 오늘부터 일주일(WBS_DAYS) 안에 걸친 업무만. 지난 업무는 건드리지 않는다.
// 미리보기(planWbsSync)로 바뀔 내용을 보여 주고, 같은 내용일 때만 반영(applyWbsSync)한다.

/** 열 위치(0부터): B 구분 · C 담당자 · D 본부 · E 유형 · F 업무명 · I 시작일 · J 종료일 · N 비고 */
const COL = { owner: 2, name: 5, start: 8, end: 9, note: 13 } as const;
/** 오늘부터 며칠 뒤까지의 업무를 새로 넣을지 */
const WBS_DAYS = 7;
const ID_RE = /\bT-[0-9a-f]{8}\b/;

type Op =
  | { kind: "add"; at: number; task: Task }
  | { kind: "update"; index: number; task: Task }
  | { kind: "link"; index: number; task: Task; note: string }
  | { kind: "remove"; index: number; id: string; name: string };

/**
 * WBS 시트 요청은 회사 계정으로 배포한 Apps Script(apps-script/wbs-proxy.gs)를 거친다.
 * 시트 공유 설정을 바꾸지 않고, 배포한 사람의 편집 권한으로 고치기 위함이다.
 */
async function wbsRequest<T>(path: string, method: "GET" | "POST" | "PUT" = "GET", data?: unknown): Promise<T> {
  const url = process.env.WBS_SCRIPT_URL?.trim();
  const key = process.env.WBS_SCRIPT_KEY?.trim();
  if (!url || !key) throw new ValidationError("WBS_SCRIPT_URL·WBS_SCRIPT_KEY 환경변수를 설정해 주세요.");
  // 웹 앱은 응답을 다른 주소로 넘겨주므로(302) 그대로 따라간다
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ key, path, method, data }),
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  let body: { status?: number; data?: T; error?: string };
  try {
    body = JSON.parse(text);
  } catch {
    // 로그인 화면 같은 HTML이 오면 배포 설정 문제다
    throw new Error("WBS 스크립트 응답을 읽지 못했어요. 웹 앱 액세스가 '모든 사용자'로 배포됐는지 확인해 주세요.");
  }
  if (body.error) throw new Error(`WBS 시트 요청 실패: ${body.error}`);
  return body.data as T;
}

const norm = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const quote = (title: string) => `'${title.replace(/'/g, "''")}'`;

/**
 * 시트에 보이는 날짜가 YYYY-MM-DD와 같은 날인지. 연도가 없으면 월·일만 비교하고,
 * 읽을 수 없는 형식이면 손대지 않도록 같다고 본다.
 */
function sameDate(cell: string | undefined, iso: string) {
  const text = norm(cell);
  if (!text) return !iso;
  const n = text.match(/\d+/g)?.map(Number);
  const [y, m, d] = iso.split("-").map(Number);
  if (!n || n.length < 2) return true;
  if (n.length >= 3 && String(n[0]).length === 4) return n[0] === y && n[1] === m && n[2] === d;
  if (n.length >= 3 && String(n[2]).length === 4) return n[2] === y && n[0] === m && n[1] === d;
  return n[n.length - 2] === m && n[n.length - 1] === d;
}

const outdated = (r: string[], t: Task) =>
  norm(r[COL.name]) !== wbsFields(t).name || !sameDate(r[COL.start], t.startDate) || !sameDate(r[COL.end], rangeEnd(t));

async function loadSheet() {
  const meta = await wbsRequest<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    "?fields=sheets.properties(sheetId,title)",
  );
  const sheet = meta.sheets.find((s) => String(s.properties.sheetId) === WBS_GID)?.properties;
  if (!sheet) throw new Error("WBS 탭을 찾을 수 없습니다.");
  const res = await wbsRequest<{ values?: string[][] }>(
    `/values/${encodeURIComponent(`${quote(sheet.title)}!A1:N`)}`,
  );
  return { sheetId: sheet.sheetId, title: sheet.title, rows: res.values ?? [] };
}

async function buildPlan() {
  if (!isSheetsConfigured()) throw new ValidationError("Google Sheets 연결 설정이 없어 WBS 동기화를 할 수 없어요.");
  const [all, sheet] = await Promise.all([listTasks(), loadSheet()]);
  if (!all.length) throw new ValidationError("업무 목록이 비어 있어 동기화하지 않았어요.");
  const allIds = new Set(all.map((t) => t.id));
  // 루틴 업무는 WBS 루틴 구역에 따로 있으므로 뺀다
  const tasks = all.filter((t) => !t.routineId);
  const from = todayStr();
  const to = addDays(from, WBS_DAYS);
  /** 새로 넣거나 예전 행에 연결할 업무: 기간이 [오늘, 오늘+7일]에 걸친 것 */
  const upcoming = tasks.filter((t) => t.startDate <= to && rangeEnd(t) >= from);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const { rows } = sheet;

  const ops: Op[] = [];
  const placed = new Set<string>();
  /** 구역마다 내 업무가 있는 마지막 행 */
  const lastRow: Partial<Record<Category, number>> = {};
  const mark = (t: Task, i: number) => {
    placed.add(t.id);
    lastRow[t.category] = Math.max(lastRow[t.category] ?? -1, i);
  };

  // 1) N열에 ID가 있는 행: 지워진 업무면 행 삭제, 내용이 바뀌었으면 수정
  const unlinked: number[] = [];
  rows.forEach((r, i) => {
    const id = r[COL.note]?.match(ID_RE)?.[0];
    if (!id) {
      if (norm(r[COL.owner]) === WBS_OWNER) unlinked.push(i);
      return;
    }
    if (!allIds.has(id)) return ops.push({ kind: "remove", index: i, id, name: norm(r[COL.name]) });
    const t = byId.get(id);
    if (!t || placed.has(id)) return;
    mark(t, i);
    if (outdated(r, t)) ops.push({ kind: "update", index: i, task: t });
  });

  // 2) 예전에 붙여 넣은 행(ID 없음, 담당자 나): 업무명이 같으면 그 행에 ID만 적어 연결
  for (const t of upcoming) {
    if (placed.has(t.id)) continue;
    const at = unlinked.findIndex((i) => norm(rows[i][COL.name]) === wbsFields(t).name);
    if (at < 0) continue;
    const [i] = unlinked.splice(at, 1);
    ops.push({ kind: "link", index: i, task: t, note: norm(rows[i][COL.note]) });
    if (outdated(rows[i], t)) ops.push({ kind: "update", index: i, task: t });
    mark(t, i);
  }

  // 3) 나머지는 새 행: 그 구역의 내 마지막 행 아래. 아직 연결된 행이 없으면 업무명이 구역 이름으로 시작하는 내 마지막 행 아래
  const missing: string[] = [];
  const pending = upcoming
    .filter((t) => !placed.has(t.id))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, "ko"));
  for (const category of Object.keys(WBS_SECTION) as Category[]) {
    const list = pending.filter((t) => t.category === category);
    if (!list.length) continue;
    const section = WBS_SECTION[category];
    const anchor =
      lastRow[category] ??
      rows.findLastIndex((r) => norm(r[COL.owner]) === WBS_OWNER && norm(r[COL.name]).startsWith(`${section} `));
    if (anchor < 0) missing.push(section);
    else for (const task of list) ops.push({ kind: "add", at: anchor + 1, task });
  }

  const token = createHash("sha256")
    .update(JSON.stringify(ops.map((o) => [o.kind, "at" in o ? o.at : o.index, "task" in o ? o.task.id : o.id])))
    .digest("hex")
    .slice(0, 16);
  return { ops, missing, token, sheet, from, to };
}

export async function planWbsSync(): Promise<WbsPlan> {
  const { ops, missing, token, from, to } = await buildPlan();
  const changes = ops.map((o): WbsChange =>
    o.kind === "remove"
      ? { kind: o.kind, row: o.index + 1, section: "", name: o.name }
      : {
          kind: o.kind,
          row: o.kind === "add" ? o.at : o.index + 1,
          section: WBS_SECTION[o.task.category],
          name: wbsFields(o.task).name,
        },
  );
  return { changes, missing, token, from, to };
}

/** 미리보기와 같은 내용이면 시트에 반영한다. 그 사이 시트나 업무가 바뀌었으면 다시 미리보기를 요청한다 */
export async function applyWbsSync(input: unknown): Promise<{ applied: number }> {
  const token = (input as { token?: unknown } | null)?.token;
  const { ops, token: current, sheet } = await buildPlan();
  if (token !== current) throw new ValidationError("그 사이 WBS 시트나 업무가 바뀌었어요. 미리보기를 다시 열어 주세요.");
  if (!ops.length) return { applied: 0 };

  // 행 넣기·지우기: 아래쪽부터 처리해야 위쪽 행 번호가 밀리지 않는다
  const removes = ops.flatMap((o) => (o.kind === "remove" ? [o.index] : []));
  const inserts = new Map<number, Task[]>();
  for (const o of ops) if (o.kind === "add") inserts.set(o.at, [...(inserts.get(o.at) ?? []), o.task]);
  const structure = [
    ...removes.map((index) => ({ index, request: { deleteDimension: { range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: index, endIndex: index + 1 } } } })),
    ...[...inserts].map(([at, list]) => ({
      index: at,
      // 위 행(같은 구역)의 서식을 그대로 이어받는다
      request: { insertDimension: { range: { sheetId: sheet.sheetId, dimension: "ROWS", startIndex: at, endIndex: at + list.length }, inheritFromBefore: true } },
    })),
  ].sort((a, b) => b.index - a.index);
  if (structure.length)
    await wbsRequest(":batchUpdate", "POST", { requests: structure.map((s) => s.request) });

  /** 행 넣기·지우기 뒤의 위치(0부터). 기존 행 x는 그 위(같은 자리 포함)에 넣은 만큼, 새 행은 더 위에 넣은 만큼 밀린다 */
  const shifted = (x: number, isNew: boolean) =>
    x +
    [...inserts].reduce((n, [at, list]) => n + ((isNew ? at < x : at <= x) ? list.length : 0), 0) -
    removes.filter((d) => d < x).length;

  const ref = (col: string, row: number) => `${quote(sheet.title)}!${col}${row + 1}`;
  const data: { range: string; values: string[][] }[] = [];
  const writeDates = (row: number, t: Task) => data.push({ range: `${ref("I", row)}:J${row + 1}`, values: [[t.startDate, rangeEnd(t)]] });
  for (const [at, list] of inserts) {
    const top = shifted(at, true);
    list.forEach((t, k) => {
      const w = wbsFields(t);
      data.push({ range: `${ref("B", top + k)}:F${top + k + 1}`, values: [[w.group, WBS_OWNER, w.org, w.type, w.name]] });
      writeDates(top + k, t);
      data.push({ range: ref("N", top + k), values: [[t.id]] });
    });
  }
  for (const o of ops) {
    if (o.kind === "update") {
      const row = shifted(o.index, false);
      data.push({ range: ref("F", row), values: [[wbsFields(o.task).name]] });
      writeDates(row, o.task);
    } else if (o.kind === "link") {
      data.push({ range: ref("N", shifted(o.index, false)), values: [[o.note ? `${o.note} ${o.task.id}` : o.task.id]] });
    }
  }
  if (data.length)
    await wbsRequest("/values:batchUpdate", "POST", { valueInputOption: "USER_ENTERED", data });
  return { applied: ops.length };
}
