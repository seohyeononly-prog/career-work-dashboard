// WBS 시트에 붙일 값. 칸반 'WBS 복사'와 업무 목록 표가 같이 쓴다.

import { companyOf, type Category, type Task } from "./types";

/** WBS 시트의 구역 이름. 기타 열은 AI리더 구역이다 */
export const WBS_SECTION: Record<Category, string> = { 취업운영: "취업운영", 일경험: "일경험", 기타: "AI리더" };

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
