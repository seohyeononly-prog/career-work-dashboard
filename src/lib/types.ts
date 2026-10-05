// 공통 타입과 상수. 서버·클라이언트 양쪽에서 사용한다.

/** 업무·일정 카테고리 */
export const CATEGORIES = ["일경험", "취업운영", "기타"] as const;
export type Category = (typeof CATEGORIES)[number];

/** 링크 카테고리 (사이드바 토글 하나씩. 업무 카테고리와 달리 기타는 없고 교육사업본부가 있음) */
export const LINK_CATEGORIES = ["일경험", "취업운영", "교육사업본부"] as const;
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

/** 업무 안의 체크리스트 한 줄 (예: 같은 업무를 여러 기업에 할 때 기업 하나) */
export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface Task extends DateRange {
  id: string;
  title: string;
  category: Category;
  status: TaskStatus;
  checklist: ChecklistItem[];
  /** 칸반 순서(작을수록 위). 새 업무는 음수로 맨 위, 0이면 아직 정하지 않은 것(맨 뒤) */
  order: number;
  /** 루틴에서 생긴 업무면 루틴 ID, 아니면 "" */
  routineId: string;
  createdAt: string; // YYYY-MM-DD HH:mm
  updatedAt: string; // YYYY-MM-DD HH:mm
}

export interface Schedule extends DateRange {
  id: string;
  title: string;
  category: Category;
}

/** 루틴 반복: 평일(월~금) / 고른 요일 / 매월 N일. 어느 쪽이든 공휴일·대체공휴일에는 생기지 않는다 */
export const REPEAT_TYPES = ["평일", "요일", "매월"] as const;
export type RepeatType = (typeof REPEAT_TYPES)[number];

/** 매월 N일이 영업일이 아닐 때 옮길 쪽: 앞 영업일 / 다음 영업일 */
export const HOLIDAY_SHIFTS = ["앞", "뒤"] as const;
export type HolidayShift = (typeof HOLIDAY_SHIFTS)[number];

/** 반복 업무. 날짜마다 칸반에 가상 카드로 보이고, 체크·끌기·수정할 때 비로소 업무로 저장된다 */
export interface Routine {
  id: string;
  title: string;
  category: Category;
  repeat: RepeatType;
  /** '요일'일 때 고른 요일 (1=월 ~ 5=금) */
  weekdays: number[];
  /** '매월'일 때 날짜 (1~31, 그달 말일보다 크면 말일) */
  monthDay: number;
  holidayShift: HolidayShift;
  /** 업무를 만들 때 넣을 체크리스트 항목 이름 */
  checklist: string[];
  /** 루틴을 적용하는 기간. 종료일이 ""면 계속 */
  startDate: string;
  endDate: string;
  /** '이 날 건너뛰기'한 날짜 */
  skipDates: string[];
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

export type TaskInput = Omit<Task, "id" | "order" | "createdAt" | "updatedAt" | "routineId"> & { routineId?: string };
export type ScheduleInput = Omit<Schedule, "id">;
export type RoutineInput = Omit<Routine, "id" | "skipDates">;
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

/** 체크리스트를 다 채웠는지에 따른 업무 상태. 체크리스트가 없으면 null(상태를 건드리지 않음) */
export const statusOfChecklist = (list: ChecklistItem[]): TaskStatus | null =>
  list.length ? (list.every((c) => c.done) ? "완료" : "대기") : null;

/** 링크 표시 순서: 드래그로 정한 순서 → 링크명 */
export const byLinkOrder = (a: LinkItem, b: LinkItem) =>
  (a.order || Infinity) - (b.order || Infinity) || a.name.localeCompare(b.name, "ko");

/** 일정 제목 맨 앞의 '[기업]'에서 기업명을 꺼낸다. 없으면 "" */
export const companyOf = (title: string) => title.match(/^\s*\[([^\]]+)\]/)?.[1].trim() ?? "";

/** 일정 제목에서 맨 앞의 '[기업]'을 뺀 나머지 */
export const withoutCompany = (title: string) => title.replace(/^\s*\[[^\]]*\]\s*/, "");

/** 기업명과 제목을 '[기업] 제목'으로 합친다. 기업이 없으면 제목만 */
export const withCompany = (company: string, title: string) => (company ? `[${company}] ${title}` : title);

/** 일경험 일정에 쓰인 기업명. 많이 쓴 순 → 이름순 */
export const companyNames = (schedules: Schedule[]) => {
  const count = new Map<string, number>();
  for (const s of schedules) {
    const c = s.category === "일경험" ? companyOf(s.title) : "";
    if (c) count.set(c, (count.get(c) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).map(([c]) => c);
};

/**
 * 일정 이름으로 자주 쓰는 단어. 일정 입력의 이름 버튼이 되고,
 * 캘린더에서는 이 단어가 들어간 일정끼리 묶는다. 앞에 있는 것부터 본다: '수당 서류'가 '수당'보다 먼저.
 */
export const SCHEDULE_KEYWORDS = ["수당 서류", "지원자 서류", "사전직무교육", "수당", "개시", "종료", "4주차", "면접", "OJT"];

/** 일정 이름('[기업]' 뺀 제목). 많이 쓴 순 → 이름순 */
export const scheduleTitles = (schedules: Schedule[]) => {
  const count = new Map<string, number>();
  for (const s of schedules) {
    const t = withoutCompany(s.title).trim();
    if (t) count.set(t, (count.get(t) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).map(([t]) => t);
};

