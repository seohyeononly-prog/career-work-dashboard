// 공통 타입과 상수. 서버·클라이언트 양쪽에서 사용한다.

export const CATEGORIES = ["취업운영", "일경험"] as const;
export type Category = (typeof CATEGORIES)[number];

export const TASK_STATUSES = ["대기", "진행 중", "완료"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["높음", "보통", "낮음"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SERVICE_TYPES = ["Drive", "Google Sheets", "Notion", "기타"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * 날짜·시간 저장 형식 (모두 한국 시간 기준, 시간대 표기 없음)
 * - 날짜: YYYY-MM-DD
 * - 일시: YYYY-MM-DD HH:mm
 */
export interface Task {
  id: string;
  title: string;
  category: Category;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD
  priority: Priority;
  description: string;
  createdAt: string; // YYYY-MM-DD HH:mm
  updatedAt: string; // YYYY-MM-DD HH:mm
}

export interface Schedule {
  id: string;
  title: string;
  category: Category;
  start: string; // YYYY-MM-DD HH:mm
  end: string; // YYYY-MM-DD HH:mm
  location: string;
  description: string;
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

/** 링크 화면 URL 경로(slug)와 카테고리 매핑 */
export const CATEGORY_SLUGS: Record<string, Category> = {
  employment: "취업운영",
  "work-experience": "일경험",
};
export const slugOf = (c: Category) =>
  c === "취업운영" ? "employment" : "work-experience";
