// 공통 타입과 상수. 서버·클라이언트 양쪽에서 사용한다.

/** 업무·일정 카테고리 */
export const CATEGORIES = ["취업운영", "일경험", "기타"] as const;
export type Category = (typeof CATEGORIES)[number];

/** 링크 카테고리 (링크 화면이 두 개로 나뉘어 있어 기타는 없음) */
export const LINK_CATEGORIES = ["취업운영", "일경험"] as const;
export type LinkCategory = (typeof LINK_CATEGORIES)[number];

export const TASK_STATUSES = ["대기", "완료"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SERVICE_TYPES = ["Drive", "Google Sheets", "Notion", "기타"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * 날짜 저장 형식: YYYY-MM-DD (한국 시간 기준)
 * 기간이 아니면 startDate만 쓰고 endDate는 ""로 둔다.
 */
export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface Task extends DateRange {
  id: string;
  title: string;
  category: Category;
  status: TaskStatus;
  /** 칸반 순서(작을수록 위). 새 업무는 음수로 맨 위, 0이면 아직 정하지 않은 것(맨 뒤) */
  order: number;
  createdAt: string; // YYYY-MM-DD HH:mm
  updatedAt: string; // YYYY-MM-DD HH:mm
}

export interface Schedule extends DateRange {
  id: string;
  title: string;
  category: Category;
}

export interface LinkItem {
  id: string;
  name: string;
  url: string;
  category: LinkCategory;
  service: ServiceType;
  description: string;
  favorite: boolean;
  /** 링크 화면 순서(작을수록 위). 0이면 아직 정하지 않은 것(그룹 맨 아래) */
  order: number;
}

export type TaskInput = Omit<Task, "id" | "order" | "createdAt" | "updatedAt">;
export type ScheduleInput = Omit<Schedule, "id">;
export type LinkInput = Omit<LinkItem, "id" | "order">;

export type DataSource = "sheets" | "dev";

/** 마지막 날(기간이 아니면 시작일) */
export const rangeEnd = (r: DateRange) => r.endDate || r.startDate;

/** 해당 날짜가 기간 안에 있는지 */
export const covers = (r: DateRange, day: string) => r.startDate <= day && rangeEnd(r) >= day;

/** 칸반 표시 순서: 드래그로 정한 순서 → 시작일 → 업무명 */
export const byOrder = (a: Task, b: Task) =>
  (a.order || Infinity) - (b.order || Infinity) ||
  a.startDate.localeCompare(b.startDate) ||
  a.title.localeCompare(b.title, "ko");

/** 링크 표시 순서: 드래그로 정한 순서 → 링크명 */
export const byLinkOrder = (a: LinkItem, b: LinkItem) =>
  (a.order || Infinity) - (b.order || Infinity) || a.name.localeCompare(b.name, "ko");
