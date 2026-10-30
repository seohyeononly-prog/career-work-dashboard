// WBS 시트에 붙일 값. 칸반 'WBS 복사'와 업무 목록 표가 같이 쓴다.

import { companyOf, type Category, type Task } from "./types";

/** WBS 시트의 구역 이름. 기타 열은 AI리더 구역이다 */
export const WBS_SECTION: Record<Category, string> = { 취업운영: "취업운영", 일경험: "일경험", 기타: "AI리더" };

/** WBS 스프레드시트와 탭(gid) */
export const WBS_SPREADSHEET_ID = "1rzAz-WZI-wsCtXZ_CDMRQjKe3mwi58HTDuvw7MqQ8dY";
export const WBS_GID = "1496926969";

/** 담당자는 항상 한 사람 */
export const WBS_OWNER = "박서현";

/**
 * 업무 한 건의 WBS 칸 값.
 * 구분(기업명 또는 구역) · 본부(T1) · 유형(T2) · 업무명(T3, 구역 이름을 앞에 붙임)
 */
export function wbsFields(t: Task) {
  const section = WBS_SECTION[t.category];
  const title = t.title.replace(/\s+/g, " ").trim();
  return {
    section,
    group: companyOf(title) || section,
    org: t.category === "일경험" ? "일경험" : /주간\s*미팅/.test(title) ? "B2G교육사업본부" : "오즈코딩스쿨",
    type: /회의|미팅/.test(title) ? "미팅" : "운영",
    name: title.startsWith(section) ? title : `${section} ${title}`,
  };
}

/** WBS 동기화 미리보기 한 줄 (서버 wbs-sync가 만든다). link는 예전에 붙여 넣은 행에 ID만 적는 것 */
export interface WbsChange {
  kind: "add" | "update" | "link" | "remove";
  /** 시트 행 번호(1부터). 추가는 이 행 아래에 들어간다 */
  row: number;
  section: string;
  name: string;
}
export interface WbsPlan {
  changes: WbsChange[];
  /** 기존 행이 없어 추가할 위치를 못 찾은 구역 */
  missing: string[];
  /** 새로 넣는 업무의 기간 (YYYY-MM-DD) */
  from: string;
  to: string;
  /** 반영할 때 미리보기와 같은 내용인지 확인하는 값 */
  token: string;
}
