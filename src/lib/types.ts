// 공통 타입과 상수. 서버·클라이언트 양쪽에서 사용한다.

export const CATEGORIES = ["취업운영", "일경험"] as const;
export type Category = (typeof CATEGORIES)[number];

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
  category: Category;
  service: ServiceType;
  description: string;
  favorite: boolean;
}

export type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt">;
export type ScheduleInput = Omit<Schedule, "id">;
export type LinkInput = Omit<LinkItem, "id">;

export type DataSource = "sheets" | "dev";

/** 마지막 날(기간이 아니면 시작일) */
export const rangeEnd = (r: DateRange) => r.endDate || r.startDate;

/** 해당 날짜가 기간 안에 있는지 */
export const covers = (r: DateRange, day: string) => r.startDate <= day && rangeEnd(r) >= day;

/** 링크 화면 URL 경로(slug)와 카테고리 매핑 */
export const CATEGORY_SLUGS: Record<string, Category> = {
  employment: "취업운영",
  "work-experience": "일경험",
};
export const slugOf = (c: Category) =>
  c === "취업운영" ? "employment" : "work-experience";
